// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

contract FileOwnershipRegistry {
    using ECDSA for bytes32;
    using EnumerableSet for EnumerableSet.AddressSet;

    address public owner; // contract admin
    uint256 public registerFee = 0.01 ether; // fee to register a file

    mapping(string => address) public fileOwners;
    mapping(string => mapping(address => AccessPermission)) public fileAccess;
    mapping(string => mapping(bytes32 => SharedAccess)) public sharedAccess;
    mapping(string => EnumerableSet.AddressSet) private grantedUsers;
    mapping(address => uint256) public nonces;

    struct AccessPermission {
        bool hasAccess;
        bool canWrite;
        uint256 expiryTime;
        address grantedBy;
    }

    struct SharedAccess {
        address owner;
        bool canWrite;
        uint256 expiryTime;
        bool isActive;
        string cid;
    }

    // EIP-712
    bytes32 private constant EIP712_DOMAIN_TYPEHASH =
        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");
    bytes32 private constant META_TRANSFER_TYPEHASH =
        keccak256("MetaTransfer(string cid,address newOwner,address owner,uint256 nonce,uint256 deadline)");
    bytes32 private immutable DOMAIN_SEPARATOR;

    // Events
    event FileRegistered(string cid, address indexed owner);
    event OwnershipTransferred(string cid, address indexed previousOwner, address indexed newOwner);
    event AccessGranted(string cid, address indexed user, bool canWrite, uint256 expiryTime);
    event AccessRevoked(string cid, address indexed user);
    event SharedAccessCreated(string cid, bytes32 linkId, bool canWrite, uint256 expiryTime);
    event MetaTransferExecuted(string cid, address indexed previousOwner, address indexed newOwner, address relayer);
    event Withdraw(address to, uint256 amount);

    constructor() payable {
        owner = msg.sender;
        DOMAIN_SEPARATOR = _buildDomainSeparator();
    }

    // ========== Core Functions ==========

    function registerFile(string calldata cid) external payable {
        require(msg.value >= registerFee, "Fee required");
        require(bytes(cid).length > 0, "CID required");
        require(fileOwners[cid] == address(0), "CID already registered");
        fileOwners[cid] = msg.sender;
        _grantOwnerPermissions(cid, msg.sender);
        emit FileRegistered(cid, msg.sender);
    }

    function transferOwnership(string calldata cid, address newOwner) external {
        address currentOwner = fileOwners[cid];
        require(currentOwner == msg.sender, "Not the owner");
        require(newOwner != address(0), "Invalid new owner");
        _performOwnershipTransfer(cid, currentOwner, newOwner);
    }

    function grantAccess(
        string calldata cid,
        address user,
        bool canWrite,
        uint256 expiryTime
    ) external {
        require(fileOwners[cid] == msg.sender, "Not the owner");
        require(user != address(0), "Invalid user");
        grantedUsers[cid].add(user);
        fileAccess[cid][user] = AccessPermission(true, canWrite, expiryTime, msg.sender);
        emit AccessGranted(cid, user, canWrite, expiryTime);
    }

    function revokeAccess(string calldata cid, address user) external {
        require(fileOwners[cid] == msg.sender, "Not the owner");
        grantedUsers[cid].remove(user);
        delete fileAccess[cid][user];
        emit AccessRevoked(cid, user);
    }

    function createSharedAccess(
        string calldata cid,
        bool canWrite,
        uint256 expiryTime
    ) external returns (bytes32) {
        require(fileOwners[cid] == msg.sender, "Not the owner");
        bytes32 linkId = keccak256(abi.encode(cid, msg.sender, block.timestamp, nonces[msg.sender]++));
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

    function claimSharedAccess(bytes32 linkId, string calldata cid) external {
        SharedAccess storage access = sharedAccess[cid][linkId];
        require(access.isActive, "Link not active");
        require(access.owner != address(0), "Invalid link");
        require(access.expiryTime == 0 || block.timestamp <= access.expiryTime, "Link expired");

        grantedUsers[cid].add(msg.sender);
        fileAccess[cid][msg.sender] = AccessPermission(
            true,
            access.canWrite,
            access.expiryTime,
            access.owner
        );
        access.isActive = false;
        emit AccessGranted(cid, msg.sender, access.canWrite, access.expiryTime);
    }

    // ========== Meta Transfer ==========

    function metaTransferOwnership(
        string calldata cid,
        address newOwner,
        address fileOwner,
        uint256 deadline,
        bytes memory signature
    ) external {
        require(block.timestamp <= deadline, "Expired");
        require(fileOwners[cid] == fileOwner, "Not owner");
        require(newOwner != address(0), "Invalid new owner");

        bytes32 structHash = keccak256(
            abi.encode(
                META_TRANSFER_TYPEHASH,
                keccak256(bytes(cid)),
                newOwner,
                fileOwner,
                nonces[fileOwner],
                deadline
            )
        );
        bytes32 digest = _hashTypedData(structHash);
        address signer = digest.recover(signature);
        require(signer == fileOwner, "Bad signature");

        nonces[fileOwner]++;
        _performOwnershipTransfer(cid, fileOwner, newOwner);
        emit MetaTransferExecuted(cid, fileOwner, newOwner, msg.sender);
    }

    // ========== Views ==========

    function hasAccess(string calldata cid, address user) external view returns (bool) {
        if (fileOwners[cid] == user) return true;
        AccessPermission memory p = fileAccess[cid][user];
        return p.hasAccess && (p.expiryTime == 0 || block.timestamp <= p.expiryTime);
    }

    function hasWriteAccess(string calldata cid, address user) external view returns (bool) {
        if (fileOwners[cid] == user) return true;
        AccessPermission memory p = fileAccess[cid][user];
        return p.hasAccess && p.canWrite && (p.expiryTime == 0 || block.timestamp <= p.expiryTime);
    }

    function getGrantedUsers(string calldata cid) external view returns (address[] memory) {
        return grantedUsers[cid].values();
    }

    // ========== Withdraw ==========

    function withdraw(address payable to) external {
        require(msg.sender == owner, "Not authorized");
        uint256 amount = address(this).balance;
        to.transfer(amount);
        emit Withdraw(to, amount);
    }

    // ========== Internal ==========

    function _performOwnershipTransfer(
        string calldata cid,
        address previousOwner,
        address newOwner
    ) internal {
        fileOwners[cid] = newOwner;
        _clearGrantedAccess(cid, newOwner);
        _grantOwnerPermissions(cid, newOwner);
        emit OwnershipTransferred(cid, previousOwner, newOwner);
    }

    function _clearGrantedAccess(string calldata cid, address keepOwner) internal {
        EnumerableSet.AddressSet storage users = grantedUsers[cid];
        address[] memory userList = users.values();
        for (uint256 i = 0; i < userList.length; i++) {
            address user = userList[i];
            if (user != keepOwner) {
                delete fileAccess[cid][user];
                users.remove(user);
            }
        }
    }

    function _grantOwnerPermissions(string calldata cid, address fileOwner) internal {
        grantedUsers[cid].add(fileOwner);
        fileAccess[cid][fileOwner] = AccessPermission(true, true, 0, fileOwner);
    }

    function _buildDomainSeparator() private view returns (bytes32) {
        return keccak256(
            abi.encode(
                EIP712_DOMAIN_TYPEHASH,
                keccak256(bytes("FileOwnershipRegistry")),
                keccak256(bytes("1")),
                block.chainid,
                address(this)
            )
        );
    }

    function _hashTypedData(bytes32 structHash) private view returns (bytes32) {
        return keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, structHash));
    }
}
