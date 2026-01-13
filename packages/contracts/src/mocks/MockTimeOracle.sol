// SPDX-License-Identifier: MIT
pragma solidity 0.8.25;
import "../interfaces/ITimeOracle.sol";

contract MockTimeOracle is ITimeOracle {
    uint256 public currentTime;

    constructor(uint256 _startTime) {
        currentTime = _startTime;
    }

    function getCurrentTime() external view override returns (uint256) {
        return currentTime;
    }

    function setCurrentTime(uint256 newTime) external override {
        currentTime = newTime;
    }
}
