import { expect } from "chai";
import { network } from "hardhat";

describe("Trading", function () {
  it("should deploy with the correct token address", async function () {
    const { ethers } = await network.connect();

    const [owner] = await ethers.getSigners();

    const EnergyToken = await ethers.getContractFactory("EnergyToken");
    const token = await EnergyToken.deploy();

    const Trading = await ethers.getContractFactory("Trading");
    const trading = await Trading.deploy(await token.getAddress());

    expect(await trading.energyToken()).to.equal(await token.getAddress());
  });

  it("should execute an energy trade", async function () {
    const { ethers } = await network.connect();

    const [owner, seller, buyer] = await ethers.getSigners();

    const EnergyToken = await ethers.getContractFactory("EnergyToken");
    const token = await EnergyToken.deploy();

    const Trading = await ethers.getContractFactory("Trading");
    const trading = await Trading.deploy(await token.getAddress());

    // Give seller 10 kWh
    await token.mint(seller.address, 10);

    // Allow Trading contract to transfer seller's energy
    await token
  .connect(seller)
  .getFunction("approve")(
    await trading.getAddress(),
    ethers.parseUnits("10", 18)
  );

    // Buyer purchases 3 kWh
    await trading
      .connect(buyer)
      .buyEnergy(seller.address, 3, {
        value: ethers.parseEther("3"),
      });

    expect(await token.balanceOf(buyer.address)).to.equal(
      ethers.parseUnits("3", 18)
    );

    expect(await trading.getTradeCount()).to.equal(1);
  });

  it("should reject a trade with incorrect payment", async function () {
    const { ethers } = await network.connect();

    const [owner, seller, buyer] = await ethers.getSigners();

    const EnergyToken = await ethers.getContractFactory("EnergyToken");
    const token = await EnergyToken.deploy();

    const Trading = await ethers.getContractFactory("Trading");
    const trading = await Trading.deploy(await token.getAddress());

    await token.mint(seller.address, 10);

    await token
      .connect(seller)
      .approve(await trading.getAddress(), ethers.parseUnits("10", 18));

    await expect(
      trading.connect(buyer).buyEnergy(seller.address, 3, {
        value: ethers.parseEther("2"),
      })
    ).to.be.revertedWith("Incorrect payment");
  });
});