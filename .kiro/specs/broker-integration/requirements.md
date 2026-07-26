# Requirements Document

## Introduction

This document specifies the requirements for integrating the Kotak Neo broker API into the Twelve trading system. The integration enables live trade execution through the existing NestJS backend while maintaining strict safety controls. The system extends the existing `KotakNeoProvider` placeholder to support full broker operations (authentication, orders, positions, holdings, trades) and introduces a global kill switch to prevent unintended live order execution. The execution flow enforces a mandatory path: AI Recommendation → Risk Engine → User Confirmation → Broker Execution. Direct AI-to-broker execution is architecturally prohibited.

## Glossary

- **Broker_Execution_Provider**: The NestJS service that wraps all Kotak Neo API interactions including authentication, order management, positions, holdings, and trades
- **Kill_Switch**: A persistent toggle that, when enabled, prevents all new live orders from being submitted to the broker regardless of other conditions
- **Kotak_Neo_API**: The external REST API provided by Kotak Securities for programmatic trading operations
- **Execution_Flow_Service**: The existing service that evaluates trade recommendations and enforces safety checks before execution
- **Risk_Engine**: The existing RiskService that validates all trades against risk rules before execution
- **Trading_Service**: The existing service that orchestrates trade execution across paper and live modes
- **Auth_Token_Store**: Secure storage for OAuth tokens used to authenticate with Kotak Neo API
- **Audit_Log**: The existing audit logging service that records all broker API interactions
- **Live_Trading_Controller**: The NestJS controller that exposes REST endpoints for live trading operations with kill switch enforcement
- **User_Confirmation**: An explicit boolean flag that must be set to true by the user before any live order can be placed

## Requirements

### Requirement 1: Kotak Neo Authentication

**User Story:** As a user, I want the system to authenticate with Kotak Neo using OAuth tokens, so that I can securely access my broker account for live trading.

#### Acceptance Criteria

1. WHEN the system starts, THE Broker_Execution_Provider SHALL load Kotak Neo API credentials from environment variables (consumer key, consumer secret, access token, session token)
2. WHEN an API call receives a 401 Unauthorized response, THE Broker_Execution_Provider SHALL attempt to refresh the session token using the stored refresh credentials
3. IF the token refresh fails, THEN THE Broker_Execution_Provider SHALL log the authentication failure to the Audit_Log and return an authentication error to the caller
4. THE Broker_Execution_Provider SHALL store authentication tokens in memory only and load secrets exclusively from environment variables
5. WHEN a valid session token exists, THE Broker_Execution_Provider SHALL include the token in all subsequent API request headers

### Requirement 2: List Orders

**User Story:** As a user, I want to retrieve my current order book from Kotak Neo, so that I can see all pending and executed orders.

#### Acceptance Criteria

1. WHEN a list orders request is made, THE Broker_Execution_Provider SHALL call the Kotak Neo order book endpoint and return the list of orders
2. THE Broker_Execution_Provider SHALL transform the Kotak Neo response into a standardized order list format containing order ID, symbol, action, quantity, filled quantity, price, status, and timestamp
3. IF the Kotak Neo API returns an error, THEN THE Broker_Execution_Provider SHALL log the error to the Audit_Log and return a descriptive error message
4. WHEN the circuit breaker is in OPEN state, THE Broker_Execution_Provider SHALL reject the request with a service unavailable error without calling the Kotak Neo API

### Requirement 3: Get Positions

**User Story:** As a user, I want to view my current open positions from Kotak Neo, so that I can monitor my live trading exposure.

#### Acceptance Criteria

1. WHEN a positions request is made, THE Broker_Execution_Provider SHALL call the Kotak Neo positions endpoint and return current open positions
2. THE Broker_Execution_Provider SHALL transform position data into a standardized format containing symbol, quantity, average price, current price, PnL, and product type
3. IF the Kotak Neo API returns an error, THEN THE Broker_Execution_Provider SHALL log the error to the Audit_Log and return a descriptive error message

### Requirement 4: Get Holdings

**User Story:** As a user, I want to view my portfolio holdings from Kotak Neo, so that I can see my long-term investment positions.

#### Acceptance Criteria

1. WHEN a holdings request is made, THE Broker_Execution_Provider SHALL call the Kotak Neo holdings endpoint and return the user's holdings
2. THE Broker_Execution_Provider SHALL transform holdings data into a standardized format containing symbol, quantity, average price, current value, and PnL
3. IF the Kotak Neo API returns an error, THEN THE Broker_Execution_Provider SHALL log the error to the Audit_Log and return a descriptive error message

### Requirement 5: Get Trades

**User Story:** As a user, I want to view my executed trades from Kotak Neo, so that I can see the fill details of my orders.

#### Acceptance Criteria

1. WHEN a trades request is made, THE Broker_Execution_Provider SHALL call the Kotak Neo trade book endpoint and return executed trades
2. THE Broker_Execution_Provider SHALL transform trade data into a standardized format containing trade ID, order ID, symbol, action, quantity, price, and execution timestamp
3. IF the Kotak Neo API returns an error, THEN THE Broker_Execution_Provider SHALL log the error to the Audit_Log and return a descriptive error message

### Requirement 6: Place Order

**User Story:** As a user, I want to place live orders through Kotak Neo, so that I can execute trades in the market.

#### Acceptance Criteria

1. WHEN a place order request is received, THE Broker_Execution_Provider SHALL validate the order parameters (symbol, action, quantity, price, order type, product type) before sending to the broker
2. WHEN order parameters are valid, THE Broker_Execution_Provider SHALL submit the order to Kotak Neo API and return the broker order ID with status
3. THE Broker_Execution_Provider SHALL log every order placement attempt to the Audit_Log including request parameters and response
4. IF the order is rejected by Kotak Neo, THEN THE Broker_Execution_Provider SHALL return the rejection reason from the broker response
5. WHEN the circuit breaker is in OPEN state, THE Broker_Execution_Provider SHALL reject the order with a service unavailable error

### Requirement 7: Modify Order

**User Story:** As a user, I want to modify my pending orders on Kotak Neo, so that I can adjust price or quantity of open orders.

#### Acceptance Criteria

1. WHEN a modify order request is received with a valid broker order ID, THE Broker_Execution_Provider SHALL send the modification request to Kotak Neo API
2. THE Broker_Execution_Provider SHALL support modification of price, quantity, order type, and trigger price fields
3. IF the order cannot be modified (already executed or cancelled), THEN THE Broker_Execution_Provider SHALL return an error with the current order status
4. THE Broker_Execution_Provider SHALL log every modification attempt to the Audit_Log

### Requirement 8: Cancel Order

**User Story:** As a user, I want to cancel my pending orders on Kotak Neo, so that I can withdraw orders that are no longer needed.

#### Acceptance Criteria

1. WHEN a cancel order request is received with a valid broker order ID, THE Broker_Execution_Provider SHALL send the cancellation request to Kotak Neo API
2. IF the cancellation succeeds, THEN THE Broker_Execution_Provider SHALL return the updated order status as CANCELLED
3. IF the order cannot be cancelled (already executed), THEN THE Broker_Execution_Provider SHALL return an error with the current order status
4. THE Broker_Execution_Provider SHALL log every cancellation attempt to the Audit_Log

### Requirement 9: Global Kill Switch

**User Story:** As a user, I want a global kill switch that prevents all live order execution, so that I can immediately halt all trading activity in an emergency.

#### Acceptance Criteria

1. THE Kill_Switch SHALL default to ENABLED (live trading OFF) when the system is first deployed
2. WHILE the Kill_Switch is ENABLED, THE Trading_Service SHALL reject all live order placement, modification, and cancellation requests with a clear error message
3. WHEN the Kill_Switch state is changed, THE Audit_Log SHALL record the state change with timestamp and the user who made the change
4. THE Kill_Switch state SHALL be stored persistently in the database so it survives application restarts
5. WHEN a user toggles the Kill_Switch, THE Live_Trading_Controller SHALL require explicit user authentication before accepting the state change
6. THE Kill_Switch SHALL be accessible via a REST API endpoint for the frontend to read and toggle

### Requirement 10: Live Trading Safety - User Confirmation

**User Story:** As a user, I want live orders to require my explicit confirmation before execution, so that no trade executes without my approval.

#### Acceptance Criteria

1. WHEN a live order request is received, THE Trading_Service SHALL verify that User_Confirmation is explicitly set to true before proceeding
2. IF User_Confirmation is false or missing, THEN THE Trading_Service SHALL reject the order and return an error stating that user confirmation is required
3. THE Trading_Service SHALL log every confirmation check result to the Audit_Log
4. THE Live_Trading_Controller SHALL include the user confirmation status in the request validation before forwarding to the Trading_Service

### Requirement 11: Execution Flow Enforcement

**User Story:** As a user, I want the system to enforce the AI → Risk Engine → User Confirmation → Broker execution path, so that no trade can bypass safety checks.

#### Acceptance Criteria

1. WHEN a live trade request is processed, THE Execution_Flow_Service SHALL validate the trade through the Risk_Engine before allowing broker execution
2. THE Broker_Execution_Provider SHALL only be callable from the Trading_Service and not be directly injectable by the AI service module
3. IF the Risk_Engine rejects the trade, THEN THE Trading_Service SHALL block broker execution and return the risk violations
4. THE Audit_Log SHALL record the complete execution flow (risk check result, user confirmation, broker response) for every live trade attempt

### Requirement 12: Audit Logging for Broker Operations

**User Story:** As a user, I want all broker API interactions to be logged for audit purposes, so that I can review a complete history of all trading operations.

#### Acceptance Criteria

1. THE Broker_Execution_Provider SHALL log every API call to the Audit_Log including endpoint, request parameters, response status, and response time
2. WHEN a broker API call fails, THE Audit_Log entry SHALL include the error message, HTTP status code, and circuit breaker state
3. THE Audit_Log SHALL record the user ID associated with each broker operation
4. THE Broker_Execution_Provider SHALL measure and log the latency of each broker API call in milliseconds

### Requirement 13: Live Trading Frontend Interface

**User Story:** As a user, I want a Live Trading section in the frontend where I can see broker status, toggle the kill switch, and manage live orders, so that I have a unified interface for live trading operations.

#### Acceptance Criteria

1. THE Live_Trading_Controller SHALL expose REST endpoints for: kill switch status, toggle kill switch, list orders, get positions, get holdings, get trades, and order management (place, modify, cancel)
2. WHEN the frontend requests broker connection status, THE Live_Trading_Controller SHALL return the current authentication state and circuit breaker state
3. THE Live_Trading_Controller SHALL validate all incoming requests and return appropriate HTTP error codes for invalid inputs
4. WHEN an order placement endpoint is called, THE Live_Trading_Controller SHALL enforce both Kill_Switch check and User_Confirmation check before delegating to the Trading_Service
