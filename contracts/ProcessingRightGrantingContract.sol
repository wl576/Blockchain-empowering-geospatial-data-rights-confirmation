// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./OwnershipRegistrationContract.sol";

contract ProcessingRightGrantingContract {
    struct Authorization {
        bytes32 authId;
        bytes32 dataId;
        address grantor;
        address grantee;
        uint256 grantTime;
        uint256 expirationTime;
        string purpose;
        string scope;
        string constraints;
        bool isValid;
    }
    
    OwnershipRegistrationContract public ownershipContract;
    
    mapping(bytes32 => Authorization) public authorizations;
    mapping(bytes32 => bytes32[]) public dataAuthorizations;
    mapping(address => bytes32[]) public granteeAuthorizations;
    
    event AuthorizationGranted(
        bytes32 indexed authId,
        bytes32 indexed dataId,
        address indexed grantor,
        address grantee,
        string purpose,
        uint256 expirationTime
    );
    
    event AuthorizationRevoked(
        bytes32 indexed authId,
        bytes32 indexed dataId,
        address indexed grantor
    );
    
    constructor(address _ownershipContractAddress) {
        ownershipContract = OwnershipRegistrationContract(_ownershipContractAddress);
    }
    
    function grantProcessingRight(
        bytes32 _dataId,
        address _grantee,
        uint256 _duration,
        string memory _purpose,
        string memory _scope,
        string memory _constraints
    ) external returns (bytes32) {
        require(
            ownershipContract.verifyOwnership(_dataId, msg.sender),
            "Not data owner"
        );
        require(_grantee != address(0), "Invalid grantee");
        require(_duration > 0, "Invalid duration");
        
        bytes32 authId = keccak256(
            abi.encodePacked(_dataId, _grantee, block.timestamp, msg.sender)
        );
        
        Authorization memory newAuth = Authorization({
            authId: authId,
            dataId: _dataId,
            grantor: msg.sender,
            grantee: _grantee,
            grantTime: block.timestamp,
            expirationTime: block.timestamp + _duration,
            purpose: _purpose,
            scope: _scope,
            constraints: _constraints,
            isValid: true
        });
        
        authorizations[authId] = newAuth;
        dataAuthorizations[_dataId].push(authId);
        granteeAuthorizations[_grantee].push(authId);
        
        emit AuthorizationGranted(
            authId,
            _dataId,
            msg.sender,
            _grantee,
            _purpose,
            newAuth.expirationTime
        );
        
        return authId;
    }
    
    function revokeAuthorization(bytes32 _authId) external {
        require(authorizations[_authId].isValid, "Authorization not valid");
        require(
            authorizations[_authId].grantor == msg.sender,
            "Not authorization grantor"
        );
        
        authorizations[_authId].isValid = false;
        
        emit AuthorizationRevoked(
            _authId,
            authorizations[_authId].dataId,
            msg.sender
        );
    }
    
    function verifyAuthorization(
        bytes32 _dataId,
        address _grantee
    ) external view returns (bool) {
        bytes32[] memory auths = dataAuthorizations[_dataId];
        
        for (uint i = 0; i < auths.length; i++) {
            Authorization memory auth = authorizations[auths[i]];
            if (auth.grantee == _grantee && 
                auth.isValid && 
                auth.expirationTime > block.timestamp) {
                return true;
            }
        }
        return false;
    }
    
    function getActiveAuthorizations(bytes32 _dataId)
        external
        view
        returns (Authorization[] memory)
    {
        bytes32[] memory authIds = dataAuthorizations[_dataId];
        uint activeCount = 0;
        
        for (uint i = 0; i < authIds.length; i++) {
            if (authorizations[authIds[i]].isValid && 
                authorizations[authIds[i]].expirationTime > block.timestamp) {
                activeCount++;
            }
        }
        
        Authorization[] memory activeAuths = new Authorization[](activeCount);
        uint currentIndex = 0;
        
        for (uint i = 0; i < authIds.length; i++) {
            Authorization memory auth = authorizations[authIds[i]];
            if (auth.isValid && auth.expirationTime > block.timestamp) {
                activeAuths[currentIndex] = auth;
                currentIndex++;
            }
        }
        
        return activeAuths;
    }
}