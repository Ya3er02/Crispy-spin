const hre = require("hardhat");
const { ethers } = require("hardhat");

async function main() {
    console.log("🚀 Deploying CrispySpin contracts to Base Sepolia...\n");

    const [deployer] = await ethers.getSigners();
    console.log("Deploying contracts with account:", deployer.address);
    console.log("Account balance:", (await deployer.getBalance()).toString());

    // Deploy Fries1155
    console.log("\n📦 Deploying Fries1155...");
    const Fries1155 = await ethers.getContractFactory("Fries1155");
    const fries1155 = await Fries1155.deploy(
        "https://api.crispyspin.xyz/metadata/", // Base URI
        deployer.address, // Admin
        deployer.address  // Minter (will be backend server in production)
    );
    await fries1155.deployed();
    console.log("✅ Fries1155 deployed to:", fries1155.address);

    // Deploy RewardVault
    console.log("\n📦 Deploying RewardVault...");
    const RewardVault = await ethers.getContractFactory("RewardVault");
    const rewardVault = await RewardVault.deploy(
        deployer.address, // Admin
        deployer.address  // Signer (will be backend server in production)
    );
    await rewardVault.deployed();
    console.log("✅ RewardVault deployed to:", rewardVault.address);

    // Save deployment info
    const deploymentInfo = {
        network: "base-sepolia",
        chainId: 84532,
        contracts: {
            Fries1155: {
                address: fries1155.address,
                deployer: deployer.address,
                deployedAt: new Date().toISOString()
            },
            RewardVault: {
                address: rewardVault.address,
                deployer: deployer.address,
                deployedAt: new Date().toISOString()
            }
        }
    };

    console.log("\n📝 Deployment Summary:");
    console.log(JSON.stringify(deploymentInfo, null, 2));

    // Verify on BaseScan
    console.log("\n⏳ Waiting for block confirmations...");
    await fries1155.deployTransaction.wait(5);
    await rewardVault.deployTransaction.wait(5);

    console.log("\n🔍 Verifying contracts on BaseScan...");
    try {
        await hre.run("verify:verify", {
            address: fries1155.address,
            constructorArguments: [
                "https://api.crispyspin.xyz/metadata/",
                deployer.address,
                deployer.address
            ],
        });
        console.log("✅ Fries1155 verified");
    } catch (error) {
        console.log("❌ Fries1155 verification failed:", error.message);
    }

    try {
        await hre.run("verify:verify", {
            address: rewardVault.address,
            constructorArguments: [
                deployer.address,
                deployer.address
            ],
        });
        console.log("✅ RewardVault verified");
    } catch (error) {
        console.log("❌ RewardVault verification failed:", error.message);
    }

    console.log("\n✨ Deployment complete!");
    console.log("\n📋 Next steps:");
    console.log("1. Update .env with contract addresses");
    console.log("2. Grant MINTER_ROLE to backend server address");
    console.log("3. Fund RewardVault with reward tokens");
    console.log("4. Configure Base Pay in frontend");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
