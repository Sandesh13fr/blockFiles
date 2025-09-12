// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract FileOwnershipRegistry {
    // Maps file CID to owner address
    mapping(string => address) public fileOwners;

    // Maps file CID to access permissions
    // cid => user => AccessPermission
    mapping(string => mapping(address => AccessPermission)) public fileAccess;

    // Maps file CID to shared access links
    // cid => linkId => SharedAccess
    mapping(string => mapping(bytes32 => SharedAccess)) public sharedAccess;

    struct AccessPermission {
        bool hasAccess;
        bool canWrite;
        uint256 expiryTime; // 0 for permanent access
        address grantedBy;
    }

    struct SharedAccess {
        address owner;
        bool canWrite;
        uint256 expiryTime;
        bool isActive;
        string cid;
    }

    // Meta-transaction support
    mapping(address => uint256) public nonces;

    // Emitted when a meta-transaction is executed
    event MetaTransactionExecuted(address userAddress, address relayerAddress, bytes functionSignature);

    // Emitted when a file is registered
    event FileRegistered(string cid, address indexed owner);

    // Emitted when ownership is transferred
    event OwnershipTransferred(string cid, address indexed previousOwner, address indexed newOwner);

    // Emitted when access is granted
    event AccessGranted(string cid, address indexed user, bool canWrite, uint256 expiryTime);

    // Emitted when access is revoked
    event AccessRevoked(string cid, address indexed user);

    // Emitted when shared access link is created
    event SharedAccessCreated(string cid, bytes32 linkId, bool canWrite, uint256 expiryTime);

    // Register a file CID to the sender's address
    function registerFile(string calldata cid) external {
        require(bytes(cid).length > 0, "CID required");
        require(fileOwners[cid] == address(0), "CID already registered");
        fileOwners[cid] = msg.sender;
        emit FileRegistered(cid, msg.sender);
    }

    // Transfer ownership of a file
    function transferOwnership(string calldata cid, address newOwner) external {
        require(fileOwners[cid] == msg.sender, "Not the owner");
        require(newOwner != address(0), "Invalid new owner");

        address previousOwner = fileOwners[cid];
        fileOwners[cid] = newOwner;

        // Transfer all access permissions to new owner
        fileAccess[cid][newOwner] = AccessPermission(true, true, 0, newOwner);

        emit OwnershipTransferred(cid, previousOwner, newOwner);
    }

    // Grant access to another user
    function grantAccess(string calldata cid, address user, bool canWrite, uint256 expiryTime) external {
        require(fileOwners[cid] == msg.sender, "Not the owner");
        require(user != address(0), "Invalid user");

        fileAccess[cid][user] = AccessPermission(true, canWrite, expiryTime, msg.sender);
        emit AccessGranted(cid, user, canWrite, expiryTime);
    }

    // Revoke access from a user
    function revokeAccess(string calldata cid, address user) external {
        require(fileOwners[cid] == msg.sender, "Not the owner");

        delete fileAccess[cid][user];
        emit AccessRevoked(cid, user);
    }

    // Create a shared access link
    function createSharedAccess(string calldata cid, bool canWrite, uint256 expiryTime) external returns (bytes32) {
        require(fileOwners[cid] == msg.sender, "Not the owner");

        bytes32 linkId = keccak256(abi.encodePacked(cid, msg.sender, block.timestamp, nonces[msg.sender]++));

        sharedAccess[cid][linkId] = SharedAccess({
            owner: msg.sender,
            canWrite: canWrite,
            expiryTime: expiryTime,
            isActive: true,
            cid: cid
        });

        emit SharedAccessCreated(cid, linkId, canWrite, expiryTime);
        return linkId;
    }

    // Claim shared access using link
    function claimSharedAccess(bytes32 linkId, string calldata cid) external {
        SharedAccess storage access = sharedAccess[cid][linkId];
        require(access.isActive, "Link not active");
        require(access.owner != address(0), "Invalid link");
        require(block.timestamp <= access.expiryTime || access.expiryTime == 0, "Link expired");

        fileAccess[cid][msg.sender] = AccessPermission(true, access.canWrite, access.expiryTime, access.owner);
        access.isActive = false; // One-time use link

        emit AccessGranted(cid, msg.sender, access.canWrite, access.expiryTime);
    }

    // Check if user has access to a file
    function hasAccess(string calldata cid, address user) external view returns (bool) {
        if (fileOwners[cid] == user) return true;

        AccessPermission memory permission = fileAccess[cid][user];
        if (!permission.hasAccess) return false;

        // Check if access has expired
        if (permission.expiryTime > 0 && block.timestamp > permission.expiryTime) {
            return false;
        }

        return true;
    }

    // Check if user has write access to a file
    function hasWriteAccess(string calldata cid, address user) external view returns (bool) {
        if (fileOwners[cid] == user) return true;

        AccessPermission memory permission = fileAccess[cid][user];
        if (!permission.hasAccess || !permission.canWrite) return false;

        // Check if access has expired
        if (permission.expiryTime > 0 && block.timestamp > permission.expiryTime) {
            return false;
        }

        return true;
    }

    // Get the owner of a file by CID
    function getOwner(string calldata cid) external view returns (address) {
        return fileOwners[cid];
    }

    // Get access permission details
    function getAccessPermission(string calldata cid, address user) external view returns (bool hasAccess, bool canWrite, uint256 expiryTime, address grantedBy) {
        AccessPermission memory permission = fileAccess[cid][user];
        return (permission.hasAccess, permission.canWrite, permission.expiryTime, permission.grantedBy);
    }

    // Get shared access details
    function getSharedAccess(string calldata cid, bytes32 linkId) external view returns (address owner, bool canWrite, uint256 expiryTime, bool isActive) {
        SharedAccess memory access = sharedAccess[cid][linkId];
        return (access.owner, access.canWrite, access.expiryTime, access.isActive);
    }

    // Meta-transaction support functions
    function getNonce(address user) external view returns (uint256) {
        return nonces[user];
    }

    // Execute meta-transaction
    /**
     * Execute a meta-transaction (gasless transaction)
     * The relayer submits the transaction on behalf of the user
     *
     * @param userAddress The address of the user
     * @param functionSignature The encoded function call
     * @param sigR Signature R
     * @param sigS Signature S
     * @param sigV Signature V
     * @return returnData The return data from the function call
     *
     * NOTE: For production, consider using EIP-712 for secure and wallet-compatible signatures
     */
    function executeMetaTransaction(
        address userAddress,
        bytes memory functionSignature,
        bytes32 sigR,
        bytes32 sigS,
        uint8 sigV
    ) external returns (bytes memory) {
        require(verify(userAddress, getMessageHash(functionSignature), sigR, sigS, sigV), "Invalid signature");

        // Increase nonce to prevent replay attacks
        nonces[userAddress]++;

        // Execute the function as the user
        (bool success, bytes memory returnData) = address(this).call(abi.encodePacked(functionSignature, userAddress));
        require(success, "Function call failed");

        emit MetaTransactionExecuted(userAddress, msg.sender, functionSignature);
        return returnData;
    }

    // Get message hash for signing
    function getMessageHash(bytes memory _data) public view returns (bytes32) {
        return keccak256(abi.encodePacked(
            "\x19Ethereum Signed Message:\n32",
            keccak256(abi.encodePacked(address(this), _data, nonces[msg.sender]))
        ));
    }

    // Verify signature
    function verify(
        address _signer,
        bytes32 _messageHash,
        bytes32 _r,
        bytes32 _s,
        uint8 _v
    ) internal pure returns (bool) {
        return _signer == ecrecover(_messageHash, _v, _r, _s);
    }
}
