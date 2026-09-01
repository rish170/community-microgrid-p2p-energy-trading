// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract EnergyToken is ERC20, Ownable {
    constructor() ERC20("Energy Token", "ENG") Ownable(msg.sender) {}

    // 1 token = 1 kWh
    function mint(address to, uint256 kWh) external onlyOwner {
        _mint(to, kWh * 10 ** decimals());
    }

    // Burn energy tokens
    function burn(uint256 kWh) external {
        _burn(msg.sender, kWh * 10 ** decimals());
    }
}