# BChain-WM

BChain-WM: A Blockchain and Digital Watermark-Based Rights Confirmation System

## Abstract
Geospatial data rights confirmation serves as the prerequisite and foundation for ensuring the secure and efficient circulation and utilization of geospatial data. Existing rights confirmation schemes, both in legal theory and practice, are confronted with three major dilemmas: ownership definition, benefit distribution, and protection mode selection. Moving beyond a purely legal perspective, this paper constructs a novel rights confirmation framework for geospatial data that integrates blockchain and digital watermarking technologies.This framework is composed of four layers: the Data Layer, the Deposit Layer, the Contract Layer, and the Application Layer. These layers respectively facilitate the generation of ownership identifiers, trusted on-chain deposit, automated execution of ownership relationships and benefit distribution, and provision of rights confirmation services applicable in judicial, regulatory, and industrial practices.Adopting an "on-chain deposit, off-chain storage" model, the framework retains sensitive data within controlled offline environments while only depositing credentials such as watermark information and ownership status onto the blockchain. This design effectively meets the requirements for centralized control and hierarchical approval. Technical validation demonstrates that the proposed framework exhibits more comprehensive performance compared to existing rights confirmation schemes. The application of this framework to geospatial data processing will contribute to realizing the secure and efficient circulation and utilization of geospatial data, thereby promoting its value.


## Requirements

BChain-WM uses the following packages with Python 3.14.2

### Blockchain & Smart Contracts
- truffle@5.11.5
- ganache-cli@7.9.7
- web3@1.10.0
- solc@0.5.16
- node@18.20.4
- crypto-js@4.2.0
- fs-extra@11.3.2

### Image Processing & Watermarking
- numpy==2.4.0
- pillow==12.1.0
- geotiff==0.2.0
- jimp==1.6.0

### Testing & Evaluation
- mocha@10.2.0
- chai@6.2.0

## Usage
### Environment Setup and Contract Deploy

Start a local Ethereum blockchain using Ganache for development and testing.

Install dependencies.
```
npm install
```

Start Ganache (in a separate terminal).
```
ganache-cli --deterministic
```

Compile smart contracts.
```
truffle compile
```

Deploy contracts to the local network.
```
truffle migrate --network development
```

Get deployed contract addresses
```
truffle networks
```

### Watermark Embedding andData Registration

Embed a DCT-based robust digital watermark into geospatial images and register the data on the blockchain.

```
node utils/watermark.js --embed --input ./tif/test_image.tif --owner 0x742d35Cc6634C0532925a3b844Bc9e0F2A5C3b3e --output ./data/test_image_registered.tif
```

Where `--embed` is the flag to perform basic watermark embedding and verification test, `--input`is the path to the original TIFF/JPEG geospatial image file, `--owner` is the Ethereum address of the data owner, `--output` is the path to save the watermarked file 

Generates detailed test results in console showing: embedding success status, blockchain registration status, data hash and transaction details, processing time


### Rights Confirmation

Verify the ownership of a registered geospatial image.

```
node utils/imageProcessor.js --verify --image ./tif --expectedOwner 0x742d35Cc6634C0532925a3b844Bc9e0F2A5C3b3e
```

Where `--verify`is the flag to verify image ownership, `--image`is the path to the watermarked/registered image file, `--expectedOwner` is the Ethereum address of the expected owner.

Returns verification results including  `verified` is the boolean indicating verification success, `watermarkMatch` is the boolean indicating watermark extraction match, `blockchainVerified` is the boolean indicating blockchain verification success, `verificationTime` is the time taken for verification in ms, `extractedOwner` is the owner ID extracted from watermark

# Run Specific Test Modules

Test the accuracy of rights confirmation.
```
node test/accuracy.test.js
```

Test compliance-related metrics.
```
node test/compliance.test.js 
```

Conduct comprehensive smart contract performance testing to evaluate the execution performance of ownership registration contracts, processing authorization contracts, and product transaction contracts.
```
python performance_test.py
```
Output performance test results file `comprehensive_contract_performance.csv` 

### Dataset

The data we used in our paper originally come from [the LEVIR-CD dataset](https://opendatalab.org.cn/OpenDataLab/LEVIR-CD).
