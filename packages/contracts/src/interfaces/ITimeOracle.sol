// SPDX-License-Identifier: MIT
pragma solidity 0.8.25;

interface ITimeOracle {
    function getCurrentTime() external view returns (uint256);
    function setCurrentTime(uint256 newTime) external;
}
