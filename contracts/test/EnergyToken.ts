import { expect } from "chai";
import { network } from "hardhat";

describe("EnergyToken", function () {
  it("should deploy with the correct name and symbol", async function () {
    const { ethers } = await network.connect();

    const EnergyToken = await ethers.getContractFactory("EnergyToken");
    const token = await EnergyToken.deploy();

    expect(await token.name()).to.equal("Energy Token");
    expect(await token.symbol()).to.equal("ENG");
  });

  it("should mint tokens representing kWh", async function () {
    const { ethers } = await network.connect();

    const [owner, user] = await ethers.getSigners();

    const EnergyToken = await ethers.getContractFactory("EnergyToken");
    const token = await EnergyToken.deploy();

    await token.mint(user.address, 10);

    expect(await token.balanceOf(user.address)).to.equal(
      ethers.parseUnits("10", 18)
    );
  });

  it("should allow a user to burn their energy tokens", async function () {
    const { ethers } = await network.connect();

    const [owner, user] = await ethers.getSigners();

    const EnergyToken = await ethers.getContractFactory("EnergyToken");
    const token = await EnergyToken.deploy();

    await token.mint(user.address, 10);

    await token.connect(user).getFunction("burn")(4);

    expect(await token.balanceOf(user.address)).to.equal(
      ethers.parseUnits("6", 18)
    );
  });
});