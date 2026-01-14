// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./OwnershipRegistrationContract.sol";
import "./ProcessingRightGrantingContract.sol";

contract ProductTradingContract {
    struct DataProduct {
        bytes32 productId;
        bytes32 originalDataId;
        bytes32[] derivativeChain;
        address creator;
        string productMetadata;
        uint256 creationTime;
        address currentOwner;
        uint256 price;
        bool isListed;
    }
    
    struct Transaction {
        bytes32 txId;
        bytes32 productId;
        address seller;
        address buyer;
        uint256 price;
        uint256 transactionTime;
    }
    
    OwnershipRegistrationContract public ownershipContract;
    ProcessingRightGrantingContract public authContract;
    
    mapping(bytes32 => DataProduct) public dataProducts;
    mapping(bytes32 => Transaction) public transactions;
    mapping(address => bytes32[]) public userTransactions;
    
    event ProductCreated(
        bytes32 indexed productId,
        bytes32 indexed originalDataId,
        address indexed creator,
        string productMetadata,
        uint256 creationTime
    );
    
    event ProductListed(
        bytes32 indexed productId,
        address indexed seller,
        uint256 price
    );
    
    event ProductSold(
        bytes32 indexed productId,
        address indexed seller,
        address indexed buyer,
        uint256 price,
        bytes32 transactionId
    );
    
    constructor(address _ownershipContract, address _authContract) {
        ownershipContract = OwnershipRegistrationContract(_ownershipContract);
        authContract = ProcessingRightGrantingContract(_authContract);
    }
    
    function createDataProduct(
        bytes32 _originalDataId,
        string memory _productMetadata,
        bytes32[] memory _derivativeChain
    ) external returns (bytes32) {
        require(
            ownershipContract.verifyOwnership(_originalDataId, msg.sender) ||
            authContract.verifyAuthorization(_originalDataId, msg.sender),
            "No rights to create derivative product"
        );
        
        bytes32 productId = keccak256(
            abi.encodePacked(_originalDataId, _productMetadata, block.timestamp, msg.sender)
        );
        
        DataProduct memory newProduct = DataProduct({
            productId: productId,
            originalDataId: _originalDataId,
            derivativeChain: _derivativeChain,
            creator: msg.sender,
            productMetadata: _productMetadata,
            creationTime: block.timestamp,
            currentOwner: msg.sender,
            price: 0,
            isListed: false
        });
        
        dataProducts[productId] = newProduct;
        
        emit ProductCreated(
            productId,
            _originalDataId,
            msg.sender,
            _productMetadata,
            block.timestamp
        );
        
        return productId;
    }
    
    function listProductForSale(bytes32 _productId, uint256 _price) external {
        require(dataProducts[_productId].currentOwner == msg.sender, "Not product owner");
        require(_price > 0, "Price must be greater than 0");
        
        dataProducts[_productId].price = _price;
        dataProducts[_productId].isListed = true;
        
        emit ProductListed(_productId, msg.sender, _price);
    }
    
    function purchaseProduct(bytes32 _productId) external payable {
        DataProduct storage product = dataProducts[_productId];
        
        require(product.isListed, "Product not listed for sale");
        require(product.currentOwner != msg.sender, "Cannot buy own product");
        require(msg.value == product.price, "Incorrect payment amount");
        
        // Validate rights chain
        require(validateRightsChain(_productId), "Invalid rights chain");
        
        address payable seller = payable(product.currentOwner);
        
        // Create transaction record
        bytes32 txId = keccak256(
            abi.encodePacked(_productId, msg.sender, block.timestamp, msg.value)
        );
        
        Transaction memory newTransaction = Transaction({
            txId: txId,
            productId: _productId,
            seller: product.currentOwner,
            buyer: msg.sender,
            price: msg.value,
            transactionTime: block.timestamp
        });
        
        transactions[txId] = newTransaction;
        userTransactions[msg.sender].push(txId);
        userTransactions[product.currentOwner].push(txId);
        
        // Transfer ownership
        product.currentOwner = msg.sender;
        product.isListed = false;
        product.price = 0;
        
        // Transfer funds
        seller.transfer(msg.value);
        
        emit ProductSold(_productId, seller, msg.sender, msg.value, txId);
    }
    
    function validateRightsChain(bytes32 _productId) 
        internal 
        view 
        returns (bool) 
    {
        DataProduct memory product = dataProducts[_productId];
        
        // Check if creator has rights to original data
        bool hasRights = ownershipContract.verifyOwnership(
            product.originalDataId, 
            product.creator
        ) || authContract.verifyAuthorization(
            product.originalDataId, 
            product.creator
        );
        
        // Validate derivative chain if exists
        for (uint i = 0; i < product.derivativeChain.length; i++) {
            bytes32 derivativeId = product.derivativeChain[i];
            DataProduct memory derivative = dataProducts[derivativeId];
            
            hasRights = hasRights && (
                ownershipContract.verifyOwnership(
                    derivative.originalDataId, 
                    derivative.creator
                ) || authContract.verifyAuthorization(
                    derivative.originalDataId, 
                    derivative.creator
                )
            );
        }
        
        return hasRights;
    }
    
    // 修改这两个函数，添加 pure 修饰符并移除未使用的参数
    function getProductTransactionHistory(bytes32 /*_productId*/)
        external
        pure
        returns (Transaction[] memory)
    {
        return new Transaction[](0);
    }

    function getUserProducts(address /*_user*/)
        external
        pure
        returns (DataProduct[] memory)
    {
        return new DataProduct[](0);
    }
}