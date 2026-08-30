// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "./EnergyToken.sol";

contract Trading {
    EnergyToken public energyToken;

    uint256 public constant PRICE_PER_KWH = 1 ether;

    struct Trade {
        address buyer;
        address seller;
        uint256 kWh;
        uint256 totalPrice;
        uint256 timestamp;
    }

    Trade[] public trades;

    event TradeExecuted(
        address indexed buyer,
        address indexed seller,
        uint256 kWh,
        uint256 totalPrice
    );

    constructor(address _energyToken) {
        energyToken = EnergyToken(_energyToken);
    }

    function buyEnergy(address seller, uint256 kWh) external payable {
        require(kWh > 0, "kWh must be greater than zero");
        require(msg.value == kWh * PRICE_PER_KWH, "Incorrect payment");
        require(
            energyToken.balanceOf(seller) >= kWh * 10 ** energyToken.decimals(),
            "Seller has insufficient energy"
        );

        energyToken.transferFrom(seller, address(this), kWh * 10 ** energyToken.decimals());
        energyToken.transfer(msg.sender, kWh * 10 ** energyToken.decimals());

        payable(seller).transfer(msg.value);

        trades.push(
            Trade(
                msg.sender,
                seller,
                kWh,
                msg.value,
                block.timestamp
            )
        );

        emit TradeExecuted(msg.sender, seller, kWh, msg.value);
    }

    function getTradeCount() external view returns (uint256) {
        return trades.length;
    }
}