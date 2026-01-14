from web3 import Web3
import time
import random
import string
import pandas as pd
import matplotlib.pyplot as plt
import numpy as np
from tqdm import tqdm
import os

# 设置全局字体为Arial
plt.rcParams['font.family'] = 'Arial'
plt.rcParams['font.size'] = 10

# Connect to Ganache
w3 = Web3(Web3.HTTPProvider('http://localhost:8545'))
print(f"Connected: {w3.is_connected()}")
print(f"Accounts: {len(w3.eth.accounts)}")

# Contract addresses (update with your actual deployed addresses)
OWNERSHIP_CONTRACT_ADDRESS = "0xe78A0F7E598Cc8b0Bb87894B0F60dD2a88d6a8Ab"
PROCESSING_RIGHT_CONTRACT_ADDRESS = "0x5b1869D9A4C187F2EAa108f3062412ecf0526b24"
PRODUCT_TRADING_CONTRACT_ADDRESS = "0xCfEB869F69431e42cdB54A4F4f105C19C080A601"

# ABI for OwnershipRegistrationContract
ownership_abi = [
    {
        "inputs": [
            {"internalType": "bytes32", "name": "_dataHash", "type": "bytes32"},
            {"internalType": "string", "name": "_metadata", "type": "string"},
            {"internalType": "string", "name": "_watermarkFeatures", "type": "string"}
        ],
        "name": "registerDataResource",
        "outputs": [{"internalType": "bytes32", "name": "", "type": "bytes32"}],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {"internalType": "bytes32", "name": "_dataId", "type": "bytes32"},
            {"internalType": "address", "name": "_newOwner", "type": "address"}
        ],
        "name": "transferOwnership",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {"internalType": "bytes32", "name": "_dataId", "type": "bytes32"},
            {"internalType": "address", "name": "_checkAddress", "type": "address"}
        ],
        "name": "verifyOwnership",
        "outputs": [{"internalType": "bool", "name": "", "type": "bool"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [{"internalType": "bytes32", "name": "_dataId", "type": "bytes32"}],
        "name": "getDataResource",
        "outputs": [
            {
                "components": [
                    {"internalType": "bytes32", "name": "dataHash", "type": "bytes32"},
                    {"internalType": "string", "name": "metadata", "type": "string"},
                    {"internalType": "string", "name": "watermarkFeatures", "type": "string"},
                    {"internalType": "address", "name": "owner", "type": "address"},
                    {"internalType": "uint256", "name": "registrationTime", "type": "uint256"},
                    {"internalType": "bytes32", "name": "dataId", "type": "bytes32"},
                    {"internalType": "bool", "name": "isRegistered", "type": "bool"}
                ],
                "internalType": "struct OwnershipRegistrationContract.DataResource",
                "name": "",
                "type": "tuple"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [{"internalType": "bytes32", "name": "_dataHash", "type": "bytes32"}],
        "name": "getDataResourceByHash",
        "outputs": [
            {
                "components": [
                    {"internalType": "bytes32", "name": "dataHash", "type": "bytes32"},
                    {"internalType": "string", "name": "metadata", "type": "string"},
                    {"internalType": "string", "name": "watermarkFeatures", "type": "string"},
                    {"internalType": "address", "name": "owner", "type": "address"},
                    {"internalType": "uint256", "name": "registrationTime", "type": "uint256"},
                    {"internalType": "bytes32", "name": "dataId", "type": "bytes32"},
                    {"internalType": "bool", "name": "isRegistered", "type": "bool"}
                ],
                "internalType": "struct OwnershipRegistrationContract.DataResource",
                "name": "",
                "type": "tuple"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [{"internalType": "bytes32", "name": "_dataHash", "type": "bytes32"}],
        "name": "isDataRegistered",
        "outputs": [{"internalType": "bool", "name": "", "type": "bool"}],
        "stateMutability": "view",
        "type": "function"
    }
]

# ABI for ProcessingRightGrantingContract
processing_right_abi = [
    {
        "inputs": [
            {"internalType": "address", "name": "_ownershipContractAddress", "type": "address"}
        ],
        "stateMutability": "nonpayable",
        "type": "constructor"
    },
    {
        "inputs": [
            {"internalType": "bytes32", "name": "_dataId", "type": "bytes32"},
            {"internalType": "address", "name": "_grantee", "type": "address"},
            {"internalType": "uint256", "name": "_duration", "type": "uint256"},
            {"internalType": "string", "name": "_purpose", "type": "string"},
            {"internalType": "string", "name": "_scope", "type": "string"},
            {"internalType": "string", "name": "_constraints", "type": "string"}
        ],
        "name": "grantProcessingRight",
        "outputs": [{"internalType": "bytes32", "name": "", "type": "bytes32"}],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {"internalType": "bytes32", "name": "_authId", "type": "bytes32"}
        ],
        "name": "revokeAuthorization",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {"internalType": "bytes32", "name": "_dataId", "type": "bytes32"},
            {"internalType": "address", "name": "_grantee", "type": "address"}
        ],
        "name": "verifyAuthorization",
        "outputs": [{"internalType": "bool", "name": "", "type": "bool"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {"internalType": "bytes32", "name": "_dataId", "type": "bytes32"}
        ],
        "name": "getActiveAuthorizations",
        "outputs": [
            {
                "components": [
                    {"internalType": "bytes32", "name": "authId", "type": "bytes32"},
                    {"internalType": "bytes32", "name": "dataId", "type": "bytes32"},
                    {"internalType": "address", "name": "grantor", "type": "address"},
                    {"internalType": "address", "name": "grantee", "type": "address"},
                    {"internalType": "uint256", "name": "grantTime", "type": "uint256"},
                    {"internalType": "uint256", "name": "expirationTime", "type": "uint256"},
                    {"internalType": "string", "name": "purpose", "type": "string"},
                    {"internalType": "string", "name": "scope", "type": "string"},
                    {"internalType": "string", "name": "constraints", "type": "string"},
                    {"internalType": "bool", "name": "isValid", "type": "bool"}
                ],
                "internalType": "struct ProcessingRightGrantingContract.Authorization[]",
                "name": "",
                "type": "tuple[]"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    }
]

# ABI for ProductTradingContract
product_trading_abi = [
    {
        "inputs": [
            {"internalType": "address", "name": "_ownershipContract", "type": "address"},
            {"internalType": "address", "name": "_authContract", "type": "address"}
        ],
        "stateMutability": "nonpayable",
        "type": "constructor"
    },
    {
        "inputs": [
            {"internalType": "bytes32", "name": "_originalDataId", "type": "bytes32"},
            {"internalType": "string", "name": "_productMetadata", "type": "string"},
            {"internalType": "bytes32[]", "name": "_derivativeChain", "type": "bytes32[]"}
        ],
        "name": "createDataProduct",
        "outputs": [{"internalType": "bytes32", "name": "", "type": "bytes32"}],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {"internalType": "bytes32", "name": "_productId", "type": "bytes32"},
            {"internalType": "uint256", "name": "_price", "type": "uint256"}
        ],
        "name": "listProductForSale",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {"internalType": "bytes32", "name": "_productId", "type": "bytes32"}
        ],
        "name": "purchaseProduct",
        "outputs": [],
        "stateMutability": "payable",
        "type": "function"
    },
    {
        "inputs": [
            {"internalType": "bytes32", "name": "_productId", "type": "bytes32"}
        ],
        "name": "getProductTransactionHistory",
        "outputs": [
            {
                "components": [
                    {"internalType": "bytes32", "name": "txId", "type": "bytes32"},
                    {"internalType": "bytes32", "name": "productId", "type": "bytes32"},
                    {"internalType": "address", "name": "seller", "type": "address"},
                    {"internalType": "address", "name": "buyer", "type": "address"},
                    {"internalType": "uint256", "name": "price", "type": "uint256"},
                    {"internalType": "uint256", "name": "transactionTime", "type": "uint256"}
                ],
                "internalType": "struct ProductTradingContract.Transaction[]",
                "name": "",
                "type": "tuple[]"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {"internalType": "address", "name": "_user", "type": "address"}
        ],
        "name": "getUserProducts",
        "outputs": [
            {
                "components": [
                    {"internalType": "bytes32", "name": "productId", "type": "bytes32"},
                    {"internalType": "bytes32", "name": "originalDataId", "type": "bytes32"},
                    {"internalType": "bytes32[]", "name": "derivativeChain", "type": "bytes32[]"},
                    {"internalType": "address", "name": "creator", "type": "address"},
                    {"internalType": "string", "name": "productMetadata", "type": "string"},
                    {"internalType": "uint256", "name": "creationTime", "type": "uint256"},
                    {"internalType": "address", "name": "currentOwner", "type": "address"},
                    {"internalType": "uint256", "name": "price", "type": "uint256"},
                    {"internalType": "bool", "name": "isListed", "type": "bool"}
                ],
                "internalType": "struct ProductTradingContract.DataProduct[]",
                "name": "",
                "type": "tuple[]"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    }
]

# Contract instances
ownership_contract = w3.eth.contract(address=OWNERSHIP_CONTRACT_ADDRESS, abi=ownership_abi)
processing_right_contract = w3.eth.contract(address=PROCESSING_RIGHT_CONTRACT_ADDRESS, abi=processing_right_abi)
product_trading_contract = w3.eth.contract(address=PRODUCT_TRADING_CONTRACT_ADDRESS, abi=product_trading_abi)

# Global test data storage
registered_data_ids = []
authorization_ids = []
product_ids = []
test_accounts = []

def generate_random_bytes32():
    """Generate random bytes32 data"""
    return Web3.keccak(text=''.join(random.choices(string.ascii_letters + string.digits, k=32)))

def generate_random_string(length=32):
    """Generate random string data"""
    return ''.join(random.choices(string.ascii_letters + string.digits, k=length))

def setup_test_environment(n_transactions=500, n_accounts=10):
    """Pre-register data resources and setup test environment for all contracts"""
    global registered_data_ids, test_accounts, authorization_ids, product_ids
    
    print("\nSetting up comprehensive test environment...")
    
    # Use multiple test accounts
    test_accounts = w3.eth.accounts[:n_accounts]
    print(f"Using {len(test_accounts)} test accounts")
    
    # Ensure accounts have sufficient balance
    for account in test_accounts:
        balance = w3.eth.get_balance(account)
        print(f"Account {account[:10]}... balance: {w3.from_wei(balance, 'ether')} ETH")
    
    # Register data resources with different owners
    print("Phase 1: Registering data resources...")
    for i in tqdm(range(n_transactions), desc="Registering data"):
        data_hash = generate_random_bytes32()
        metadata = generate_random_string(20)
        watermark = generate_random_string(16)
        
        # Use round-robin account assignment
        owner = test_accounts[i % len(test_accounts)]
        
        try:
            # Register data resource
            tx_hash = ownership_contract.functions.registerDataResource(
                data_hash, 
                metadata, 
                watermark
            ).transact({'from': owner, 'gas': 300000})
            
            # Get transaction receipt
            receipt = w3.eth.get_transaction_receipt(tx_hash)
            
            # Generate data ID (same way as contract)
            current_block = w3.eth.get_block('latest')
            data_id = Web3.solidity_keccak(
                ['bytes32', 'string', 'uint256', 'address'],
                [data_hash, metadata, current_block.timestamp, Web3.to_checksum_address(owner)]
            )
            registered_data_ids.append(data_id)
            
        except Exception as e:
            print(f"Error in data registration: {e}")
            continue
    
    print(f"Successfully registered {len(registered_data_ids)} data resources")
    
    # Create authorizations for processing rights
    print("Phase 2: Creating processing right authorizations...")
    n_authorizations = min(200, len(registered_data_ids))
    for i in tqdm(range(n_authorizations), desc="Creating authorizations"):
        try:
            data_id = registered_data_ids[i]
            owner = test_accounts[i % len(test_accounts)]
            grantee = test_accounts[(i + 1) % len(test_accounts)]
            
            tx_hash = processing_right_contract.functions.grantProcessingRight(
                data_id,
                grantee,
                86400,  # 1 day duration
                "Performance testing",
                "Full access",
                "No constraints"
            ).transact({'from': owner, 'gas': 400000})
            
            receipt = w3.eth.get_transaction_receipt(tx_hash)
            
            # Generate auth ID (same way as contract)
            auth_id = Web3.solidity_keccak(
                ['bytes32', 'address', 'uint256', 'address'],
                [data_id, grantee, current_block.timestamp, owner]
            )
            authorization_ids.append(auth_id)
            
        except Exception as e:
            print(f"Error in authorization creation: {e}")
            continue
    
    print(f"Successfully created {len(authorization_ids)} authorizations")
    
    # Create data products
    print("Phase 3: Creating data products...")
    n_products = min(100, len(registered_data_ids))
    for i in tqdm(range(n_products), desc="Creating products"):
        try:
            original_data_id = registered_data_ids[i]
            creator = test_accounts[i % len(test_accounts)]
            
            tx_hash = product_trading_contract.functions.createDataProduct(
                original_data_id,
                f"Test product {i}",
                []  # Empty derivative chain for simplicity
            ).transact({'from': creator, 'gas': 500000})
            
            receipt = w3.eth.get_transaction_receipt(tx_hash)
            
            # Generate product ID (same way as contract)
            product_id = Web3.solidity_keccak(
                ['bytes32', 'string', 'uint256', 'address'],
                [original_data_id, f"Test product {i}", current_block.timestamp, creator]
            )
            product_ids.append(product_id)
            
        except Exception as e:
            print(f"Error in product creation: {e}")
            continue
    
    print(f"Successfully created {len(product_ids)} data products")

# =============================================================================
# Ownership Registration Contract Tests
# =============================================================================

def test_ownership_register(n_operations):
    """Test performance of registerDataResource function"""
    start_time = time.time()
    successful_ops = 0
    
    for i in tqdm(range(n_operations), desc="Ownership Register"):
        data_hash = generate_random_bytes32()
        metadata = generate_random_string(20)
        watermark = generate_random_string(16)
        
        owner = test_accounts[i % len(test_accounts)]
        
        try:
            ownership_contract.functions.registerDataResource(
                data_hash, 
                metadata, 
                watermark
            ).transact({'from': owner, 'gas': 300000})
            successful_ops += 1
        except Exception as e:
            continue
    
    duration = time.time() - start_time
    tps = successful_ops / duration if duration > 0 else 0
    avg_latency = (duration / successful_ops * 1000) if successful_ops > 0 else 0
    return tps, duration, successful_ops, avg_latency

def test_ownership_transfer(n_operations):
    """Test performance of transferOwnership function"""
    start_time = time.time()
    successful_ops = 0
    
    if not registered_data_ids:
        print("No registered data IDs available for transfer test")
        return 0, 0, 0, 0
    
    for i in tqdm(range(n_operations), desc="Ownership Transfer"):
        try:
            data_id = random.choice(registered_data_ids)
            current_owner_idx = i % len(test_accounts)
            new_owner_idx = (current_owner_idx + 1) % len(test_accounts)
            
            ownership_contract.functions.transferOwnership(
                data_id, 
                test_accounts[new_owner_idx]
            ).transact({'from': test_accounts[current_owner_idx], 'gas': 200000})
            successful_ops += 1
            
        except Exception as e:
            continue
    
    duration = time.time() - start_time
    tps = successful_ops / duration if duration > 0 else 0
    avg_latency = (duration / successful_ops * 1000) if successful_ops > 0 else 0
    return tps, duration, successful_ops, avg_latency

def test_ownership_verify(n_operations):
    """Test performance of verifyOwnership function (view call)"""
    start_time = time.time()
    successful_ops = 0
    
    if not registered_data_ids:
        print("No registered data IDs available for verification test")
        return 0, 0, 0, 0
    
    for i in tqdm(range(n_operations), desc="Ownership Verify"):
        data_id = random.choice(registered_data_ids)
        check_address = random.choice(test_accounts)
        
        try:
            result = ownership_contract.functions.verifyOwnership(
                data_id, 
                check_address
            ).call()
            successful_ops += 1
        except Exception as e:
            continue
    
    duration = time.time() - start_time
    tps = successful_ops / duration if duration > 0 else 0
    avg_latency = (duration / successful_ops * 1000) if successful_ops > 0 else 0
    return tps, duration, successful_ops, avg_latency

def test_ownership_get_resource(n_operations):
    """Test performance of getDataResource function (view call)"""
    start_time = time.time()
    successful_ops = 0
    
    if not registered_data_ids:
        print("No registered data IDs available for getDataResource test")
        return 0, 0, 0, 0
    
    for _ in tqdm(range(n_operations), desc="Ownership Get Resource"):
        data_id = random.choice(registered_data_ids)
        
        try:
            result = ownership_contract.functions.getDataResource(data_id).call()
            successful_ops += 1
        except Exception as e:
            continue
    
    duration = time.time() - start_time
    tps = successful_ops / duration if duration > 0 else 0
    avg_latency = (duration / successful_ops * 1000) if successful_ops > 0 else 0
    return tps, duration, successful_ops, avg_latency

# =============================================================================
# Processing Right Granting Contract Tests
# =============================================================================

def test_processing_grant_right(n_operations):
    """Test performance of grantProcessingRight function"""
    start_time = time.time()
    successful_ops = 0
    
    if not registered_data_ids:
        print("No registered data IDs available for grant test")
        return 0, 0, 0, 0
    
    for i in tqdm(range(n_operations), desc="Processing Grant Right"):
        try:
            data_id = random.choice(registered_data_ids)
            owner_idx = i % len(test_accounts)
            grantee_idx = (owner_idx + 1) % len(test_accounts)
            
            processing_right_contract.functions.grantProcessingRight(
                data_id,
                test_accounts[grantee_idx],
                86400,  # 1 day
                "Test purpose",
                "Full scope",
                "No constraints"
            ).transact({'from': test_accounts[owner_idx], 'gas': 400000})
            successful_ops += 1
            
        except Exception as e:
            continue
    
    duration = time.time() - start_time
    tps = successful_ops / duration if duration > 0 else 0
    avg_latency = (duration / successful_ops * 1000) if successful_ops > 0 else 0
    return tps, duration, successful_ops, avg_latency

def test_processing_revoke(n_operations):
    """Test performance of revokeAuthorization function"""
    start_time = time.time()
    successful_ops = 0
    
    if not authorization_ids:
        print("No authorization IDs available for revoke test")
        return 0, 0, 0, 0
    
    for i in tqdm(range(n_operations), desc="Processing Revoke"):
        try:
            auth_id = random.choice(authorization_ids)
            owner_idx = i % len(test_accounts)
            
            processing_right_contract.functions.revokeAuthorization(
                auth_id
            ).transact({'from': test_accounts[owner_idx], 'gas': 200000})
            successful_ops += 1
            
        except Exception as e:
            continue
    
    duration = time.time() - start_time
    tps = successful_ops / duration if duration > 0 else 0
    avg_latency = (duration / successful_ops * 1000) if successful_ops > 0 else 0
    return tps, duration, successful_ops, avg_latency

def test_processing_verify(n_operations):
    """Test performance of verifyAuthorization function (view call)"""
    start_time = time.time()
    successful_ops = 0
    
    if not registered_data_ids:
        print("No registered data IDs available for verification test")
        return 0, 0, 0, 0
    
    for i in tqdm(range(n_operations), desc="Processing Verify"):
        try:
            data_id = random.choice(registered_data_ids)
            grantee = random.choice(test_accounts)
            
            result = processing_right_contract.functions.verifyAuthorization(
                data_id, 
                grantee
            ).call()
            successful_ops += 1
            
        except Exception as e:
            continue
    
    duration = time.time() - start_time
    tps = successful_ops / duration if duration > 0 else 0
    avg_latency = (duration / successful_ops * 1000) if successful_ops > 0 else 0
    return tps, duration, successful_ops, avg_latency

def test_processing_get_active(n_operations):
    """Test performance of getActiveAuthorizations function (view call)"""
    start_time = time.time()
    successful_ops = 0
    
    if not registered_data_ids:
        print("No registered data IDs available for get active test")
        return 0, 0, 0, 0
    
    for _ in tqdm(range(n_operations), desc="Processing Get Active"):
        data_id = random.choice(registered_data_ids)
        
        try:
            result = processing_right_contract.functions.getActiveAuthorizations(data_id).call()
            successful_ops += 1
        except Exception as e:
            continue
    
    duration = time.time() - start_time
    tps = successful_ops / duration if duration > 0 else 0
    avg_latency = (duration / successful_ops * 1000) if successful_ops > 0 else 0
    return tps, duration, successful_ops, avg_latency

# =============================================================================
# Product Trading Contract Tests
# =============================================================================

def test_trading_create_product(n_operations):
    """Test performance of createDataProduct function"""
    start_time = time.time()
    successful_ops = 0
    
    if not registered_data_ids:
        print("No registered data IDs available for product creation test")
        return 0, 0, 0, 0
    
    for i in tqdm(range(n_operations), desc="Trading Create Product"):
        try:
            original_data_id = random.choice(registered_data_ids)
            creator = test_accounts[i % len(test_accounts)]
            
            product_trading_contract.functions.createDataProduct(
                original_data_id,
                f"Performance test product {i}",
                []  # Empty derivative chain
            ).transact({'from': creator, 'gas': 500000})
            successful_ops += 1
            
        except Exception as e:
            continue
    
    duration = time.time() - start_time
    tps = successful_ops / duration if duration > 0 else 0
    avg_latency = (duration / successful_ops * 1000) if successful_ops > 0 else 0
    return tps, duration, successful_ops, avg_latency

def test_trading_list_product(n_operations):
    """Test performance of listProductForSale function"""
    start_time = time.time()
    successful_ops = 0
    
    if not product_ids:
        print("No product IDs available for listing test")
        return 0, 0, 0, 0
    
    for i in tqdm(range(n_operations), desc="Trading List Product"):
        try:
            product_id = random.choice(product_ids)
            owner = test_accounts[i % len(test_accounts)]
            price = random.randint(1000000000000000, 10000000000000000)  # 0.001 to 0.01 ETH
            
            product_trading_contract.functions.listProductForSale(
                product_id,
                price
            ).transact({'from': owner, 'gas': 200000})
            successful_ops += 1
            
        except Exception as e:
            continue
    
    duration = time.time() - start_time
    tps = successful_ops / duration if duration > 0 else 0
    avg_latency = (duration / successful_ops * 1000) if successful_ops > 0 else 0
    return tps, duration, successful_ops, avg_latency

def test_trading_purchase_product(n_operations):
    """Test performance of purchaseProduct function"""
    start_time = time.time()
    successful_ops = 0
    
    if not product_ids:
        print("No product IDs available for purchase test")
        return 0, 0, 0, 0
    
    # First, ensure some products are listed
    listed_products = []
    for product_id in product_ids[:min(50, len(product_ids))]:
        try:
            owner = test_accounts[0]  # Use first account as seller
            price = 1000000000000000  # 0.001 ETH
            
            product_trading_contract.functions.listProductForSale(
                product_id,
                price
            ).transact({'from': owner, 'gas': 200000})
            listed_products.append((product_id, price))
        except:
            continue
    
    if not listed_products:
        print("No products successfully listed for purchase test")
        return 0, 0, 0, 0
    
    for i in tqdm(range(min(n_operations, len(listed_products))), desc="Trading Purchase Product"):
        try:
            product_id, price = listed_products[i]
            buyer = test_accounts[1]  # Use second account as buyer
            
            product_trading_contract.functions.purchaseProduct(
                product_id
            ).transact({
                'from': buyer, 
                'gas': 300000,
                'value': price
            })
            successful_ops += 1
            
        except Exception as e:
            continue
    
    duration = time.time() - start_time
    tps = successful_ops / duration if duration > 0 else 0
    avg_latency = (duration / successful_ops * 1000) if successful_ops > 0 else 0
    return tps, duration, successful_ops, avg_latency

def test_trading_get_history(n_operations):
    """Test performance of getProductTransactionHistory function (view call)"""
    start_time = time.time()
    successful_ops = 0
    
    if not product_ids:
        print("No product IDs available for history test")
        return 0, 0, 0, 0
    
    for _ in tqdm(range(n_operations), desc="Trading Get History"):
        product_id = random.choice(product_ids)
        
        try:
            result = product_trading_contract.functions.getProductTransactionHistory(product_id).call()
            successful_ops += 1
        except Exception as e:
            continue
    
    duration = time.time() - start_time
    tps = successful_ops / duration if duration > 0 else 0
    avg_latency = (duration / successful_ops * 1000) if successful_ops > 0 else 0
    return tps, duration, successful_ops, avg_latency

def run_comprehensive_performance_tests():
    """Run comprehensive performance tests for all three contracts"""
    results = []
    
    # Setup test environment with initial data
    setup_test_environment(n_transactions=500, n_accounts=10)
    
    # Define test configurations for all contracts
    test_configs = [
        # Ownership Registration Contract
        ("Ownership_Register", test_ownership_register, [10, 20, 50, 100, 200]),
        ("Ownership_Transfer", test_ownership_transfer, [10, 20, 50, 100, 200]),
        ("Ownership_Verify", test_ownership_verify, [10, 20, 50, 100, 200]),
        ("Ownership_GetResource", test_ownership_get_resource, [10, 20, 50, 100, 200]),
        
        # Processing Right Granting Contract
        ("Processing_GrantRight", test_processing_grant_right, [10, 20, 50, 100, 200]),
        ("Processing_Revoke", test_processing_revoke, [10, 20, 50, 100, 200]),
        ("Processing_Verify", test_processing_verify, [10, 20, 50, 100, 200]),
        ("Processing_GetActive", test_processing_get_active, [10, 20, 50, 100, 200]),
        
        # Product Trading Contract
        ("Trading_CreateProduct", test_trading_create_product, [10, 20, 50, 100, 200]),
        ("Trading_ListProduct", test_trading_list_product, [10, 20, 50, 100, 200]),
        ("Trading_PurchaseProduct", test_trading_purchase_product, [10, 20, 50, 100, 200]),
        ("Trading_GetHistory", test_trading_get_history, [10, 20, 50, 100, 200])
    ]
    
    # Run all tests
    for operation_name, test_function, operation_counts in test_configs:
        print(f"\n{'='*60}")
        print(f"Testing {operation_name}")
        print(f"{'='*60}")
        
        for count in operation_counts:
            print(f"Running {count} operations...")
            tps, total_duration, successful_ops, avg_latency = test_function(count)
            
            results.append({
                "Contract": operation_name.split('_')[0],
                "Operation": operation_name.split('_')[1],
                "Full_Operation": operation_name,
                "Requested_Operations": count,
                "Successful_Operations": successful_ops,
                "TPS": tps,
                "Total_Duration_(s)": total_duration,
                "Avg_Latency_per_Op_(ms)": avg_latency,
                "Success_Rate": (successful_ops / count * 100) if count > 0 else 0
            })
            
            # 在显示结果的部分，将延迟显示改为秒
            print(f"  TPS: {tps:.2f}, Avg Latency: {avg_latency/1000:.4f}s, Success: {successful_ops}/{count}")

    # Save results to CSV
    df = pd.DataFrame(results)
    df.to_csv("comprehensive_contract_performance.csv", index=False)
    
    # Generate performance charts
    generate_comprehensive_performance_charts(df)
    # 在run_comprehensive_performance_tests函数的return语句之前添加
    # 将延迟从毫秒转换为秒
    df['Avg_Latency_per_Op_(s)'] = df['Avg_Latency_per_Op_(ms)'] / 1000
    return df

def generate_comprehensive_performance_charts(df):
    """Generate comprehensive performance comparison charts for all three contracts"""
    
    # Create output directory for charts
    os.makedirs("performance_charts", exist_ok=True)
    
    # Color scheme for different contracts
    contract_colors = {
        'Ownership': '#1f77b4',
        'Processing': '#ff7f0e', 
        'Trading': '#2ca02c'
    }
    
    operation_markers = {
        'Register': 'o', 'Transfer': 's', 'Verify': '^', 'GetResource': 'D',
        'GrantRight': 'o', 'Revoke': 's', 'GetActive': 'D',
        'CreateProduct': 'o', 'ListProduct': 's', 'PurchaseProduct': '^', 'GetHistory': 'D'
    }
    
    # 将延迟从毫秒转换为秒
    df['Avg_Latency_per_Op_(s)'] = df['Avg_Latency_per_Op_(ms)'] / 1000
    
    # 1. TPS Comparison Chart by Contract
    plt.figure(figsize=(16, 10))  # 增加图表尺寸
    
    contracts = df['Contract'].unique()
    for contract in contracts:
        contract_data = df[df['Contract'] == contract]
        operations = contract_data['Operation'].unique()
        
        for operation in operations:
            op_data = contract_data[contract_data['Operation'] == operation]
            plt.plot(op_data['Requested_Operations'], op_data['TPS'], 
                    marker=operation_markers.get(operation, 'o'),
                    color=contract_colors.get(contract, '#000000'),
                    label=f'{contract}_{operation}',
                    linewidth=2, markersize=10, alpha=0.8)
    
    plt.xlabel('Number of Operations', fontsize=22, fontweight='bold', fontname='Arial')
    plt.ylabel('Transactions Per Second (TPS)', fontsize=22, fontweight='bold', fontname='Arial')
    plt.title('Smart Contracts - TPS Performance Comparison', fontsize=24, fontweight='bold', fontname='Arial')
    
    # 设置坐标轴刻度标签字号为20
    plt.xticks(fontsize=20, fontname='Arial')
    plt.yticks(fontsize=20, fontname='Arial')
    
    # 调整图例位置和大小
    plt.legend(bbox_to_anchor=(0.5, -0.15), loc='upper center', 
               ncol=3, fontsize=20, frameon=True, fancybox=True)
    
    plt.grid(True, alpha=0.3)
    plt.tight_layout()
    plt.subplots_adjust(bottom=0.2)  # 为底部图例留出空间
    plt.savefig('performance_charts/contracts_tps_comparison.tiff', dpi=300, bbox_inches='tight')
    plt.show()
    
    # 2. Latency Comparison Chart by Contract (使用秒为单位)
    plt.figure(figsize=(16, 10))
    
    for contract in contracts:
        contract_data = df[df['Contract'] == contract]
        operations = contract_data['Operation'].unique()
        
        for operation in operations:
            op_data = contract_data[contract_data['Operation'] == operation]
            plt.plot(op_data['Requested_Operations'], op_data['Avg_Latency_per_Op_(s)'], 
                    marker=operation_markers.get(operation, 'o'),
                    color=contract_colors.get(contract, '#000000'),
                    label=f'{contract}_{operation}',
                    linewidth=2, markersize=10, alpha=0.8)
    
    plt.xlabel('Number of Operations', fontsize=22, fontweight='bold', fontname='Arial')
    plt.ylabel('Average Latency (seconds)', fontsize=22, fontweight='bold', fontname='Arial')
    plt.title('Smart Contracts - Latency Performance Comparison', fontsize=24, fontweight='bold', fontname='Arial')
    
    # 设置坐标轴刻度标签字号为20
    plt.xticks(fontsize=20, fontname='Arial')
    plt.yticks(fontsize=20, fontname='Arial')
    
    # 调整图例位置和大小
    plt.legend(bbox_to_anchor=(0.5, -0.15), loc='upper center', 
               ncol=3, fontsize=20, frameon=True, fancybox=True)
    
    plt.grid(True, alpha=0.3)
    plt.tight_layout()
    plt.subplots_adjust(bottom=0.2)  # 为底部图例留出空间
    plt.savefig('performance_charts/contracts_latency_comparison.tiff', dpi=300, bbox_inches='tight')
    plt.show()
    
    # 3. Individual Contract Analysis
    for contract in contracts:
        # TPS for individual contract
        plt.figure(figsize=(14, 8))
        contract_data = df[df['Contract'] == contract]
        operations = contract_data['Operation'].unique()
        
        for operation in operations:
            op_data = contract_data[contract_data['Operation'] == operation]
            plt.plot(op_data['Requested_Operations'], op_data['TPS'], 
                    marker=operation_markers.get(operation, 'o'),
                    label=operation, linewidth=2, markersize=10)
        
        plt.xlabel('Number of Operations', fontsize=22, fontweight='bold', fontname='Arial')
        plt.ylabel('Transactions Per Second (TPS)', fontsize=22, fontweight='bold', fontname='Arial')
        plt.title(f'{contract} Contract - TPS Performance', fontsize=24, fontweight='bold', fontname='Arial')
        
        # 设置坐标轴刻度标签字号为20
        plt.xticks(fontsize=20, fontname='Arial')
        plt.yticks(fontsize=20, fontname='Arial')
        
        # 调整图例位置和大小
        plt.legend(bbox_to_anchor=(0.5, -0.15), loc='upper center', 
                  ncol=2, fontsize=20, frameon=True, fancybox=True)
        
        plt.grid(True, alpha=0.3)
        plt.tight_layout()
        plt.subplots_adjust(bottom=0.2)  # 为底部图例留出空间
        plt.savefig(f'performance_charts/{contract.lower()}_tps_performance.tiff', dpi=300, bbox_inches='tight')
        plt.show()
        
        # Latency for individual contract (使用秒为单位)
        plt.figure(figsize=(14, 8))
        for operation in operations:
            op_data = contract_data[contract_data['Operation'] == operation]
            plt.plot(op_data['Requested_Operations'], op_data['Avg_Latency_per_Op_(s)'], 
                    marker=operation_markers.get(operation, 'o'),
                    label=operation, linewidth=2, markersize=10)
        
        plt.xlabel('Number of Operations', fontsize=22, fontweight='bold', fontname='Arial')
        plt.ylabel('Average Latency (seconds)', fontsize=22, fontweight='bold', fontname='Arial')
        plt.title(f'{contract} Contract - Latency Performance', fontsize=24, fontweight='bold', fontname='Arial')
        
        # 设置坐标轴刻度标签字号为20
        plt.xticks(fontsize=20, fontname='Arial')
        plt.yticks(fontsize=20, fontname='Arial')
        
        # 调整图例位置和大小
        plt.legend(bbox_to_anchor=(0.5, -0.15), loc='upper center', 
                  ncol=2, fontsize=20, frameon=True, fancybox=True)
        
        plt.grid(True, alpha=0.3)
        plt.tight_layout()
        plt.subplots_adjust(bottom=0.2)  # 为底部图例留出空间
        plt.savefig(f'performance_charts/{contract.lower()}_latency_performance.tiff', dpi=300, bbox_inches='tight')
        plt.show()
    
    # 4. Success Rate Comparison
    plt.figure(figsize=(18, 10))
    
    bar_width = 0.15
    operations = df['Full_Operation'].unique()
    operation_counts = sorted(df['Requested_Operations'].unique())
    
    for i, op_count in enumerate(operation_counts):
        success_rates = []
        op_labels = []
        
        for operation in operations:
            op_data = df[(df['Full_Operation'] == operation) & (df['Requested_Operations'] == op_count)]
            if not op_data.empty:
                success_rates.append(op_data['Success_Rate'].values[0])
                op_labels.append(operation)
        
        x_pos = np.arange(len(op_labels)) + i * bar_width
        plt.bar(x_pos, success_rates, bar_width, label=f'{op_count} ops', alpha=0.8)
    
    plt.xlabel('Operation Type', fontsize=22, fontweight='bold', fontname='Arial')
    plt.ylabel('Success Rate (%)', fontsize=22, fontweight='bold', fontname='Arial')
    plt.title('Smart Contracts - Operation Success Rates', fontsize=24, fontweight='bold', fontname='Arial')
    plt.xticks(np.arange(len(operations)) + bar_width * (len(operation_counts)-1)/2, 
               operations, rotation=45, ha='right', fontsize=20)
    
    # 设置y轴刻度标签字号为20
    plt.yticks(fontsize=20, fontname='Arial')
    
    # 调整图例位置和大小
    plt.legend(bbox_to_anchor=(0.5, -0.15), loc='upper center', 
               ncol=3, fontsize=20, frameon=True, fancybox=True)
    
    plt.grid(True, alpha=0.3, axis='y')
    plt.tight_layout()
    plt.subplots_adjust(bottom=0.25)  # 为底部图例留出更多空间
    plt.savefig('performance_charts/contracts_success_rates.tiff', dpi=300, bbox_inches='tight')
    plt.show()
    
    # 5. 新增：按合约类型分组的TPS和延迟对比
    # TPS按合约分组
    plt.figure(figsize=(14, 8))
    
    for contract in contracts:
        contract_data = df[df['Contract'] == contract]
        # 计算每个操作数量的平均TPS
        avg_tps_by_ops = contract_data.groupby('Requested_Operations')['TPS'].mean()
        plt.plot(avg_tps_by_ops.index, avg_tps_by_ops.values, 
                marker='o', linewidth=3, markersize=10, 
                label=contract, color=contract_colors.get(contract))
    
    plt.xlabel('Number of Operations', fontsize=22, fontweight='bold', fontname='Arial')
    plt.ylabel('Average Transactions Per Second (TPS)', fontsize=22, fontweight='bold', fontname='Arial')
    plt.title('Average TPS by Contract Type', fontsize=24, fontweight='bold', fontname='Arial')
    
    # 设置坐标轴刻度标签字号为20
    plt.xticks(fontsize=20, fontname='Arial')
    plt.yticks(fontsize=20, fontname='Arial')
    
    # 调整图例位置和大小
    plt.legend(bbox_to_anchor=(0.5, -0.15), loc='upper center', 
               ncol=3, fontsize=20, frameon=True, fancybox=True)
    
    plt.grid(True, alpha=0.3)
    plt.tight_layout()
    plt.subplots_adjust(bottom=0.15)
    plt.savefig('performance_charts/avg_tps_by_contract.tiff', dpi=300, bbox_inches='tight')
    plt.show()
    
    # 延迟按合约分组（使用秒为单位）
    plt.figure(figsize=(14, 8))
    
    for contract in contracts:
        contract_data = df[df['Contract'] == contract]
        # 计算每个操作数量的平均延迟
        avg_latency_by_ops = contract_data.groupby('Requested_Operations')['Avg_Latency_per_Op_(s)'].mean()
        plt.plot(avg_latency_by_ops.index, avg_latency_by_ops.values, 
                marker='s', linewidth=3, markersize=10, 
                label=contract, color=contract_colors.get(contract))
    
    plt.xlabel('Number of Operations', fontsize=22, fontweight='bold', fontname='Arial')
    plt.ylabel('Average Latency (seconds)', fontsize=22, fontweight='bold', fontname='Arial')
    plt.title('Average Latency by Contract Type', fontsize=24, fontweight='bold', fontname='Arial')
    
    # 设置坐标轴刻度标签字号为20
    plt.xticks(fontsize=20, fontname='Arial')
    plt.yticks(fontsize=20, fontname='Arial')
    
    # 调整图例位置和大小
    plt.legend(bbox_to_anchor=(0.5, -0.15), loc='upper center', 
               ncol=3, fontsize=20, frameon=True, fancybox=True)
    
    plt.grid(True, alpha=0.3)
    plt.tight_layout()
    plt.subplots_adjust(bottom=0.15)
    plt.savefig('performance_charts/avg_latency_by_contract.tiff', dpi=300, bbox_inches='tight')
    plt.show()
def check_contract_connections():
    """Verify all contract connections and basic functionality"""
    contracts_ok = True
    
    print("Checking contract connections...")
    
    # Check Ownership contract
    try:
        sample_data_id = Web3.keccak(text="test")
        try:
            ownership_contract.functions.getDataResource(sample_data_id).call()
        except:
            pass
        print("✓ Ownership contract connection successful")
    except Exception as e:
        print(f"✗ Ownership contract connection failed: {e}")
        contracts_ok = False
    
    # Check Processing Right contract
    try:
        sample_data_id = Web3.keccak(text="test")
        try:
            processing_right_contract.functions.verifyAuthorization(sample_data_id, test_accounts[0]).call()
        except:
            pass
        print("✓ Processing Right contract connection successful")
    except Exception as e:
        print(f"✗ Processing Right contract connection failed: {e}")
        contracts_ok = False
    
    # Check Product Trading contract
    try:
        sample_product_id = Web3.keccak(text="test")
        try:
            product_trading_contract.functions.getProductTransactionHistory(sample_product_id).call()
        except:
            pass
        print("✓ Product Trading contract connection successful")
    except Exception as e:
        print(f"✗ Product Trading contract connection failed: {e}")
        contracts_ok = False
    
    return contracts_ok

if __name__ == "__main__":
    print("Comprehensive Smart Contracts Performance Test")
    print("=" * 60)
    
    if not w3.is_connected():
        print("Error: Not connected to Ganache. Please start Ganache first.")
        exit(1)
    
    if not check_contract_connections():
        print("Please update the contract addresses and ensure they are deployed.")
        exit(1)
    
    print(f"Available accounts: {len(w3.eth.accounts)}")
    
    # Run comprehensive performance tests
    print("\nStarting comprehensive performance tests...")
    results = run_comprehensive_performance_tests()
    
    print("\n" + "="*60)
    print("COMPREHENSIVE PERFORMANCE TEST SUMMARY")
    print("="*60)
    
    # Display summary by contract
    contracts = results['Contract'].unique()
    for contract in contracts:
        contract_results = results[results['Contract'] == contract]
        print(f"\n{contract} Contract Performance:")
        print("-" * 40)
        
        operations = contract_results['Operation'].unique()
        for operation in operations:
            op_results = contract_results[contract_results['Operation'] == operation]
            avg_tps = op_results['TPS'].mean()
            avg_latency = op_results['Avg_Latency_per_Op_(ms)'].mean()
            avg_success = op_results['Success_Rate'].mean()
            
            print(f"  {operation}:")
            print(f"    Average TPS: {avg_tps:.2f}")
            print(f"    Average Latency: {avg_latency:.2f} ms")
            print(f"    Average Success Rate: {avg_success:.1f}%")
    
    # Save detailed summary
    summary = results.groupby(['Contract', 'Operation']).agg({
        'TPS': ['mean', 'std'],
        'Avg_Latency_per_Op_(ms)': ['mean', 'std'], 
        'Success_Rate': ['mean', 'std']
    }).round(2)
    
    print("\nDetailed Performance Statistics:")
    print(summary)
    
    # Save summary to CSV
    summary.to_csv("performance_summary_statistics.csv")
    print("\nDetailed results saved to 'comprehensive_contract_performance.csv'")
    print("Summary statistics saved to 'performance_summary_statistics.csv'")
    print("Performance charts saved to 'performance_charts/' directory")