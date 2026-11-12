// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/// @title Community Microgrid P2P Energy Trading Settlement (Option B - Native ETH)
/// @notice Settles energy trades directly in test ETH between consumer and prosumer without token dependencies
contract Trading {
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
        uint256 totalPrice,
        uint256 timestamp
    );

    /// @notice Direct ETH settlement between consumer and prosumer
    /// @param seller The address of the prosumer selling solar/battery surplus
    /// @param kWh The amount of energy being purchased in kilowatt-hours
    function buyEnergy(address payable seller, uint256 kWh) external payable {
        require(seller != address(0), "Invalid seller address");
        require(kWh > 0, "kWh must be greater than zero");
        require(msg.value > 0, "Payment must be greater than zero");

        // Forward payment directly to seller
        (bool sent, ) = seller.call{value: msg.value}("");
        require(sent, "Failed to send Ether to seller");

        trades.push(Trade(
            msg.sender,
            seller,
            kWh,
            msg.value,
            block.timestamp
        ));

        emit TradeExecuted(msg.sender, seller, kWh, msg.value, block.timestamp);
    }

    function getTradeCount() external view returns (uint256) {
        return trades.length;
    }
}
