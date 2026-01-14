// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract OwnershipRegistrationContract {
    struct DataResource {
        bytes32 dataHash;
        string metadata;
        string watermarkFeatures;
        address owner;
        uint256 registrationTime;
        bytes32 dataId;
        bool isRegistered;
    }

    mapping(bytes32 => DataResource) public dataResources;
    mapping(address => bytes32[]) public ownerDataIds;
    mapping(bytes32 => bytes32) public hashToDataId;
    
    // 新增：数据ID到数据哈希的反向映射
    mapping(bytes32 => bytes32) public dataIdToHash;
    
    // 新增：所有者到数据哈希的映射，便于查询
    mapping(address => mapping(bytes32 => bool)) public ownerToDataHashes;

    event DataRegistered(
        bytes32 indexed dataId,
        address indexed owner,
        bytes32 dataHash,
        string metadata,
        uint256 timestamp
    );

    event OwnershipTransferred(
        bytes32 indexed dataId,
        address indexed from,
        address indexed to
    );

    function registerDataResource(
        bytes32 _dataHash,
        string memory _metadata,
        string memory _watermarkFeatures
    ) external returns (bytes32) {
        require(_dataHash != bytes32(0), "Invalid data hash");
        require(hashToDataId[_dataHash] == bytes32(0), "Data already registered");

        bytes32 dataId = keccak256(
            abi.encodePacked(_dataHash, _metadata, block.timestamp, msg.sender)
        );

        DataResource memory newResource = DataResource({
            dataHash: _dataHash,
            metadata: _metadata,
            watermarkFeatures: _watermarkFeatures,
            owner: msg.sender,
            registrationTime: block.timestamp,
            dataId: dataId,
            isRegistered: true
        });

        dataResources[dataId] = newResource;
        hashToDataId[_dataHash] = dataId;
        dataIdToHash[dataId] = _dataHash; // 新增反向映射
        ownerToDataHashes[msg.sender][_dataHash] = true; // 新增所有者映射
        ownerDataIds[msg.sender].push(dataId);

        emit DataRegistered(
            dataId,
            msg.sender,
            _dataHash,
            _metadata,
            block.timestamp
        );

        return dataId;
    }

    // 新增：通过数据哈希获取完整资源信息
    function getDataResourceByHash(bytes32 _dataHash) 
        external 
        view 
        returns (DataResource memory) 
    {
        bytes32 dataId = hashToDataId[_dataHash];
        require(dataId != bytes32(0), "Data not registered");
        return dataResources[dataId];
    }

    // 新增：检查数据哈希是否已注册
    function isDataRegistered(bytes32 _dataHash) external view returns (bool) {
        return hashToDataId[_dataHash] != bytes32(0);
    }

    // 新增：获取用户的所有数据哈希
    function getOwnerDataHashes(address _owner) 
        external 
        view 
        returns (bytes32[] memory) 
    {
        bytes32[] memory dataIds = ownerDataIds[_owner];
        bytes32[] memory hashes = new bytes32[](dataIds.length);
        
        for (uint i = 0; i < dataIds.length; i++) {
            hashes[i] = dataResources[dataIds[i]].dataHash;
        }
        
        return hashes;
    }

    // 保持原有函数不变
    function verifyOwnershipByHash(bytes32 _dataHash, address _checkAddress)
        external
        view
        returns (bool)
    {
        bytes32 dataId = hashToDataId[_dataHash];
        if (dataId == bytes32(0)) {
            return false;
        }
        return dataResources[dataId].owner == _checkAddress;
    }

    function transferOwnership(bytes32 _dataId, address _newOwner) external {
        require(dataResources[_dataId].isRegistered, "Data not registered");
        require(dataResources[_dataId].owner == msg.sender, "Not owner");
        require(_newOwner != address(0), "Invalid new owner");
        
        // 更新所有者映射
        bytes32 dataHash = dataResources[_dataId].dataHash;
        ownerToDataHashes[msg.sender][dataHash] = false;
        ownerToDataHashes[_newOwner][dataHash] = true;
        
        dataResources[_dataId].owner = _newOwner;
        emit OwnershipTransferred(_dataId, msg.sender, _newOwner);
    }

    function verifyOwnership(bytes32 _dataId, address _checkAddress)
        external
        view
        returns (bool)
    {
        return dataResources[_dataId].owner == _checkAddress;
    }

    function getDataResource(bytes32 _dataId)
        external
        view
        returns (DataResource memory)
    {
        require(dataResources[_dataId].isRegistered, "Data not registered");
        return dataResources[_dataId];
    }

    function getDataIdByHash(bytes32 _dataHash) external view returns (bytes32) {
        return hashToDataId[_dataHash];
    }
}