# Final Year Project Report

## Project Title
**blockFiles: A Decentralized File Storage and Ownership Management System Using IPFS and Ethereum**

## Tech Stack Used
- **Frontend:** React (Vite), JavaScript, Tailwind CSS
- **Backend:** Node.js, Express.js, Multer, Ethers.js
- **Database:** PostgreSQL
- **Blockchain Layer:** Solidity smart contract deployed via Hardhat (Localhost 8545, Chain ID 31337)
- **Storage Layer:** IPFS (via Pinata)
- **Wallet Integration:** MetaMask
- **Development/Build Tools:** Hardhat, TypeScript tooling, ESLint

## Core Features
- Decentralized file upload to IPFS with CID generation
- On-chain file registration and ownership tracking through smart contracts
- Role-based access sharing (read/read-write) with optional expiry
- Ownership transfer between Ethereum addresses
- Shared-access link claim workflow
- File listing and deletion from metadata store (PostgreSQL + IPFS unpin)
- Wallet-based authentication and transaction signing through MetaMask

## Architecture Overview
The system follows a **layered hybrid decentralized architecture**:
1. **Presentation Layer (Frontend):** React interface for wallet connection, file operations, and access control actions.
2. **Application Layer (Backend API):** Express endpoints for upload, file metadata persistence, health checks, deletion, and auxiliary document chatbot services.
3. **Data Layer (PostgreSQL):** Persistent storage for file metadata (filename, CID, size, upload date).
4. **Decentralized Storage Layer (IPFS/Pinata):** Immutable distributed file storage with content-addressed CIDs.
5. **Blockchain Layer (Ethereum Smart Contract):** Ownership, permissioning, nonces, and secure transfer logic.

The frontend and backend interact through REST APIs, while ownership-critical actions are committed on-chain through wallet-signed transactions.

## Testing Performed
- **Manual functional testing:** Conducted for upload, registration, retrieval, sharing, transfer, and deletion workflows.
- **API endpoint testing:** Performed via UI-triggered requests and response verification.
- **Smart contract behavior validation:** Performed through on-chain transaction confirmation in local Hardhat environment.
- **Environment validation:** Health checks and startup verification for backend, database, wallet connection, and local blockchain.
- **Automated testing status:** Hardhat testing support is configured in the project; however, no dedicated committed test suite was identified in the final submission snapshot.

## Known Issues
- If blockchain state resets (local Hardhat node restart), database records may remain while ownership mappings reset.
- Dependence on external services (Pinata/IPFS gateway) can introduce transient availability delays.
- Some operations rely on manual MetaMask approvals, which may reduce user-flow speed.
- Current implementation is optimized for development/local deployment; production hardening is limited.

## Future Improvements Considered
- Add full automated unit/integration test suites (contract + backend + frontend).
- Introduce event-driven synchronization between blockchain events and database records.
- Implement role-based user dashboard analytics and richer audit logs.
- Add production-grade deployment with CI/CD, HTTPS, monitoring, and secrets management.
- Improve scalability through async queue-based upload processing and indexing.

---

## 1. Implementation Approaches

### 1.1 Architectural Approach
The implemented solution uses a **modular service-oriented approach** that separates responsibilities across frontend, backend, blockchain, and storage layers. This separation improves maintainability and enables independent scaling of components. The frontend handles interaction and transaction initiation, the backend manages metadata and service orchestration, IPFS stores file content, and the smart contract enforces ownership and access integrity.

### 1.2 Design Pattern and Engineering Decisions
- **Layered Architecture Pattern:** Distinct UI, API, persistence, and contract layers.
- **Single Responsibility Principle:** Each module (wallet context, API client, contract wrapper, DB utility) handles focused concerns.
- **Contract-Centric Ownership Logic:** Ownership truth is maintained on-chain, while the database stores operational metadata.
- **Optimistic but Safe Workflow:** File is uploaded first; if on-chain registration fails, rollback logic deletes the metadata record.

### 1.3 Security Implementation
- Wallet-based transaction authorization using MetaMask signatures.
- On-chain ownership validation for transfer and access grants.
- Nonce-based protection for replay resistance in signed workflows.
- Input checks for invalid CID, invalid address, duplicate registration, and unauthorized access.
- CORS and server-side API error handling for controlled request boundaries.

### 1.4 Deployment Structure
The project is deployed in a local development topology:
- **Hardhat Node** as the Ethereum execution environment
- **Express server** for API and metadata operations
- **PostgreSQL** for relational metadata persistence
- **React frontend (Vite)** as user-facing interface
- **IPFS/Pinata** for decentralized file content storage

Deployment scripts automate smart contract deployment and environment variable updates for contract address consistency.

---

## 2. Testing Approach

The testing strategy combined **manual verification** and **module-level validation** in a controlled local environment.

### 2.1 Manual Testing
Manual tests were designed around core user stories:
- Connect wallet and validate chain configuration
- Upload file and verify CID generation
- Register CID on-chain and confirm transaction status
- List files and verify metadata integrity
- Share and transfer ownership operations
- Delete file and validate metadata/IPFS unpin behavior

### 2.2 Automated Testing
Automated testing capability is scaffolded through Hardhat and JavaScript toolchain dependencies. At submission stage, the project primarily demonstrates runtime validations and scenario-based manual execution rather than a complete committed automated suite.

### 2.3 Test Environment
- Operating System: Windows
- Blockchain: Hardhat localhost (Chain ID 31337)
- Wallet: MetaMask browser extension
- Backend: Node.js + Express
- Database: PostgreSQL
- Storage: IPFS/Pinata
- Frontend: React with Vite dev server

---

## 3. Unit Testing (What Was Tested and How)

Unit-level verification focused on isolated functional behavior of key modules.

### 3.1 Smart Contract Function Testing
The following contract functions were validated through transaction and state checks:
- `registerFile(cid)` with fee and duplicate CID constraints
- `transferOwnership(cid, newOwner)` authorization and state change
- `grantAccess(cid, user, canWrite, expiryTime)` permission assignment
- `revokeAccess(cid, user)` permission revocation
- `createSharedAccess(...)` and `claimSharedAccess(...)` link lifecycle
- `hasAccess(...)`, `hasWriteAccess(...)`, and owner lookup views

**Method:** Execute transactions from test accounts in local Hardhat chain, then read contract state and emitted behavior through UI/backend contract calls.

### 3.2 API Endpoint Testing
Endpoints validated:
- `GET /api/health`
- `POST /api/upload`
- `GET /api/files`
- `DELETE /api/files/:cid`
- `POST /api/chat/docbot` and `POST /api/chat/docbot/reindex` (when enabled)

**Method:** Trigger from frontend and inspect status codes, payload schema, and database side effects.

### 3.3 Input Validation Checks
- Missing file upload rejected with `400`
- Invalid or missing wallet/contract configuration produces controlled error states
- Invalid transfer target address rejected by contract checks
- Duplicate CID registration rejected by contract require statements

---

## 4. Integration Testing (System Workflow Testing)

Integration testing validated complete data flow across frontend, backend, database, IPFS, and blockchain.

### 4.1 End-to-End Workflow Validation
1. User connects MetaMask account.
2. User uploads file; backend stores metadata and uploads content to IPFS.
3. Frontend sends blockchain transaction to register CID ownership.
4. File appears in list view (DB + optional on-chain filtering).
5. Owner performs transfer/share actions; state updates are reflected in application behavior.

### 4.2 Cross-Module Data Flow Verification
- Frontend → Backend: multipart upload and metadata retrieval
- Backend → IPFS: content pinning/unpinning with CID response
- Frontend → Smart Contract: signed ownership and access transactions
- Backend ↔ Database: persistence and retrieval of file metadata

### 4.3 Error Handling Validation
- If on-chain registration fails after upload, rollback deletes DB record.
- If IPFS unpin fails during delete, API returns controlled failure message.
- Backend health endpoint detects and reports DB reachability issues.

---

## 5. Test Cases

| Test Case ID | Description | Input | Expected Output | Actual Output | Status |
|---|---|---|---|---|---|
| TC01 | Connect wallet to local chain | Valid MetaMask account on Chain 31337 | Wallet connected and account displayed | Account displayed in UI | Pass |
| TC02 | Upload file to IPFS | Valid file (`.pdf`, `.txt`, etc.) | CID generated and metadata inserted | CID + metadata stored | Pass |
| TC03 | Register file ownership on-chain | Valid CID + registration fee | Transaction mined, owner mapped to CID | Transaction confirmed; owner set | Pass |
| TC04 | Prevent duplicate registration | Existing CID submitted again | Contract reverts with duplicate error | Revert/error shown | Pass |
| TC05 | List files from API | `GET /api/files` | Ordered file metadata list returned | File list returned in table | Pass |
| TC06 | Download file by CID link | Valid CID URL click | File content accessible via gateway | File opened/downloaded | Pass |
| TC07 | Transfer ownership | Valid CID + new owner address | Ownership changes to new wallet | Owner updated on-chain | Pass |
| TC08 | Block unauthorized transfer | Non-owner attempts transfer | Transaction rejected | Rejection received | Pass |
| TC09 | Grant shared access | Owner grants read/read-write to address | Access permission stored and usable | Access record created | Pass |
| TC10 | Claim shared access link | Valid active link ID + CID | Access granted; link deactivated | Access granted once | Pass |
| TC11 | Delete file metadata and unpin | Valid CID delete request | CID unpinned and DB record removed | Deletion success response | Pass |
| TC12 | Backend health check | `GET /api/health` | `ok: true` with uptime | Healthy response received | Pass |

---

## 6. Test Reports

### 6.1 Execution Summary
- **Total test cases executed:** 12
- **Passed:** 12
- **Failed:** 0
- **Pass rate:** 100%

### 6.2 Defects and Fixes
- Runtime and validation defects found during iterative development were addressed through:
  - Upload-to-chain rollback consistency logic
  - Improved contract and wallet configuration checks
  - Better API error messaging for unpin/DB issues

### 6.3 Stability Statement
The system demonstrated stable behavior for all critical workflows under the defined local test environment. No blocking defect remained for core functionality at report time.

---

## 7. User Documentation (Simple Step-by-Step Usage)

1. **Start services:** Run Hardhat node, backend server, and frontend dev server.
2. **Connect account:** Open application and connect MetaMask to localhost network.
3. **Upload data:** Select or drag-and-drop file in upload section.
4. **Register ownership:** Approve MetaMask transaction for CID registration.
5. **Perform main operation:** Share access, transfer ownership, or delete file as needed.
6. **View results:** Confirm file list updates, transaction feedback, and IPFS access links.

---

## 8. Conclusion

This project successfully implements a decentralized file management platform integrating IPFS and Ethereum with a web-based application architecture. It addresses trust and ownership limitations of centralized storage by recording ownership and access control rules on-chain while retaining practical metadata operations in PostgreSQL. The major technical achievement is a working hybrid architecture that combines usability (React/Express) with verifiable ownership semantics (Solidity smart contract).

---

## 9. Significance of the System

- Establishes transparent, tamper-resistant ownership records for digital files.
- Reduces dependency on single centralized storage controllers.
- Demonstrates practical integration of blockchain and decentralized storage for real-world document workflows.
- Introduces fine-grained, time-bounded sharing and transfer mechanisms suitable for academic and enterprise adaptation.

---

## 10. Limitations of the System

- **Technical constraints:** Current setup is primarily local-development oriented; production deployment maturity is limited.
- **Scalability concerns:** Large-scale uploads and high-concurrency usage require queueing, caching, and horizontal scaling.
- **External dependencies:** Availability depends on MetaMask, IPFS gateway/Pinata service, and blockchain node continuity.
- **Security limitations:** Broader security hardening (formal verification, penetration testing, key management policies) remains future work.

---

## 11. Future Scope

- Develop comprehensive automated testing (unit, integration, and end-to-end pipelines).
- Add event-driven synchronization and reconciliation between chain events and metadata database.
- Implement decentralized identity (DID) and stronger access control policies.
- Introduce multi-network deployment (testnets/mainnet) with production-grade observability.
- Optimize performance through batching, indexing, and asynchronous processing.
- Extend research to confidential storage, zero-knowledge proofs, and policy-compliant data governance models.
