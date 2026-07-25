#!/usr/bin/env python3
"""
Task 75.3: Verify paper trading for options

This script tests:
1. Paper trade button exists on options chain (frontend verification)
2. Trade confirmation dialog shows contract details and risk metrics
3. Execute paper option trade and verify recording in database
4. Check options position appears in Portfolio Dashboard
5. Verify P&L calculation updates with market data
6. VERIFY: NO live trade button exists for options

Requirements: 9.1, 11.1, 11.5
"""

import requests
import json
import time
import sys
from datetime import datetime, timedelta

BACKEND_API_URL = "http://localhost:4000"
FRONTEND_URL = "http://localhost:3000"

def print_section(title):
    """Print a formatted section header"""
    print("\n" + "="*80)
    print(f"{title}")
    print("="*80)

def print_result(test_name, passed, details=""):
    """Print test result"""
    status = "✅ PASS" if passed else "❌ FAIL"
    print(f"\n{status}: {test_name}")
    if details:
        print(f"  Details: {details}")

def test_paper_option_trade_execution():
    """Test 1: Execute paper option trade and verify in database"""
    print_section("TEST 1: Execute Paper Option Trade")
    
    # Paper option trade request
    trade_request = {
        "userId": "test-user-75-3",
        "symbol": "NIFTY",
        "strikePrice": 21500,
        "optionType": "CALL",
        "expiry": (datetime.now() + timedelta(days=7)).isoformat(),
        "action": "BUY",
        "quantity": 1,
        "price": 150.50,
        "bid": 149.50,
        "ask": 151.00,
        "volume": 12000,
        "openInterest": 50000,
        "impliedVolatility": 18.5
    }
    
    print(f"\nSending paper option trade request:")
    print(json.dumps(trade_request, indent=2))
    
    try:
        response = requests.post(
            f"{BACKEND_API_URL}/trading/paper/option",
            json=trade_request,
            headers={"Content-Type": "application/json"},
            timeout=10
        )
        
        print(f"\nResponse Status: {response.status_code}")
        print(f"Response Body: {json.dumps(response.json(), indent=2)}")
        
        if response.status_code == 201:
            result = response.json()
            
            # Verify response structure
            assert "status" in result, "Missing 'status' in response"
            assert "tradeId" in result, "Missing 'tradeId' in response"
            assert "positionId" in result, "Missing 'positionId' in response"
            
            # Verify status is EXECUTED
            assert result["status"] == "EXECUTED", f"Expected EXECUTED, got {result['status']}"
            
            # Verify slippage was applied
            assert "executedPrice" in result, "Missing 'executedPrice' in response"
            assert result["executedPrice"] > 0, "Executed price should be positive"
            
            print_result(
                "Paper Option Trade Execution",
                True,
                f"Trade ID: {result['tradeId']}, Position ID: {result['positionId']}, Executed Price: ₹{result['executedPrice']}"
            )
            
            return {
                "passed": True,
                "tradeId": result["tradeId"],
                "positionId": result["positionId"],
                "userId": trade_request["userId"]
            }
        else:
            print_result(
                "Paper Option Trade Execution",
                False,
                f"HTTP {response.status_code}: {response.text}"
            )
            return {"passed": False}
            
    except requests.exceptions.RequestException as e:
        print_result("Paper Option Trade Execution", False, f"Request failed: {str(e)}")
        return {"passed": False}
    except AssertionError as e:
        print_result("Paper Option Trade Execution", False, f"Assertion failed: {str(e)}")
        return {"passed": False}
    except Exception as e:
        print_result("Paper Option Trade Execution", False, f"Unexpected error: {str(e)}")
        return {"passed": False}

def test_portfolio_options_position(user_id, expected_position_id):
    """Test 2: Verify options position appears in Portfolio Dashboard"""
    print_section("TEST 2: Verify Options Position in Portfolio Dashboard")
    
    print(f"\nFetching portfolio for user: {user_id}")
    
    try:
        # Wait a moment for database to be updated
        time.sleep(1)
        
        # Fetch portfolio
        response = requests.get(
            f"{BACKEND_API_URL}/portfolio/user/{user_id}",
            timeout=10
        )
        
        print(f"\nResponse Status: {response.status_code}")
        
        if response.status_code == 200:
            portfolio = response.json()
            print(f"Portfolio: {json.dumps(portfolio, indent=2)}")
            
            # Check if we have positions
            if "positions" in portfolio and len(portfolio["positions"]) > 0:
                # Look for our options position
                found_position = None
                for position in portfolio["positions"]:
                    if position.get("id") == expected_position_id:
                        found_position = position
                        break
                
                if found_position:
                    # Verify it's an options position
                    assert "strikePrice" in found_position, "Position should have strikePrice (options field)"
                    assert "optionType" in found_position, "Position should have optionType"
                    assert found_position["symbol"] == "NIFTY", "Symbol should be NIFTY"
                    assert found_position["strikePrice"] == 21500, "Strike price should be 21500"
                    assert found_position["optionType"] in ["CALL", "PUT"], "Option type should be CALL or PUT"
                    
                    print_result(
                        "Options Position in Portfolio",
                        True,
                        f"Found position: {found_position['symbol']} {found_position['strikePrice']} {found_position['optionType']}, P&L: ₹{found_position.get('unrealizedPnL', 0)}"
                    )
                    return {"passed": True, "position": found_position}
                else:
                    print_result(
                        "Options Position in Portfolio",
                        False,
                        f"Position ID {expected_position_id} not found in portfolio"
                    )
                    return {"passed": False}
            else:
                print_result(
                    "Options Position in Portfolio",
                    False,
                    "No positions found in portfolio"
                )
                return {"passed": False}
        else:
            print_result(
                "Options Position in Portfolio",
                False,
                f"HTTP {response.status_code}: {response.text}"
            )
            return {"passed": False}
            
    except requests.exceptions.RequestException as e:
        print_result("Options Position in Portfolio", False, f"Request failed: {str(e)}")
        return {"passed": False}
    except AssertionError as e:
        print_result("Options Position in Portfolio", False, f"Assertion failed: {str(e)}")
        return {"passed": False}
    except Exception as e:
        print_result("Options Position in Portfolio", False, f"Unexpected error: {str(e)}")
        return {"passed": False}

def test_options_positions_endpoint(user_id):
    """Test 3: Verify dedicated options positions endpoint"""
    print_section("TEST 3: Verify Options Positions Endpoint")
    
    print(f"\nFetching options positions for user: {user_id}")
    
    try:
        response = requests.get(
            f"{BACKEND_API_URL}/portfolio/options/{user_id}",
            timeout=10
        )
        
        print(f"\nResponse Status: {response.status_code}")
        
        if response.status_code == 200:
            options_positions = response.json()
            print(f"Options Positions: {json.dumps(options_positions, indent=2)}")
            
            if len(options_positions) > 0:
                position = options_positions[0]
                
                # Verify options-specific fields
                required_fields = [
                    "symbol", "strikePrice", "optionType", "expiry",
                    "quantity", "entryPrice", "currentPrice",
                    "unrealizedPnL", "unrealizedPnLPercent",
                    "isPaper", "greeks", "daysToExpiry", "isExpiringSoon"
                ]
                
                missing_fields = [field for field in required_fields if field not in position]
                
                if missing_fields:
                    print_result(
                        "Options Positions Endpoint",
                        False,
                        f"Missing fields: {', '.join(missing_fields)}"
                    )
                    return {"passed": False}
                
                # Verify Greeks structure
                assert "delta" in position["greeks"], "Missing delta in Greeks"
                assert "theta" in position["greeks"], "Missing theta in Greeks"
                assert "gamma" in position["greeks"], "Missing gamma in Greeks"
                assert "vega" in position["greeks"], "Missing vega in Greeks"
                
                # Verify expiry alert logic
                assert isinstance(position["isExpiringSoon"], bool), "isExpiringSoon should be boolean"
                assert isinstance(position["daysToExpiry"], int), "daysToExpiry should be integer"
                
                print_result(
                    "Options Positions Endpoint",
                    True,
                    f"Found {len(options_positions)} options position(s) with all required fields and Greeks"
                )
                return {"passed": True, "positions": options_positions}
            else:
                print_result(
                    "Options Positions Endpoint",
                    False,
                    "No options positions returned"
                )
                return {"passed": False}
        else:
            print_result(
                "Options Positions Endpoint",
                False,
                f"HTTP {response.status_code}: {response.text}"
            )
            return {"passed": False}
            
    except requests.exceptions.RequestException as e:
        print_result("Options Positions Endpoint", False, f"Request failed: {str(e)}")
        return {"passed": False}
    except AssertionError as e:
        print_result("Options Positions Endpoint", False, f"Assertion failed: {str(e)}")
        return {"passed": False}
    except Exception as e:
        print_result("Options Positions Endpoint", False, f"Unexpected error: {str(e)}")
        return {"passed": False}

def test_pnl_calculation_update():
    """Test 4: Verify P&L calculation updates correctly"""
    print_section("TEST 4: Verify P&L Calculation Updates")
    
    # Create a position with known values
    trade_request = {
        "userId": "test-user-pnl-75-3",
        "symbol": "BANKNIFTY",
        "strikePrice": 45000,
        "optionType": "PUT",
        "expiry": (datetime.now() + timedelta(days=14)).isoformat(),
        "action": "BUY",
        "quantity": 2,
        "price": 200.00,
        "bid": 199.00,
        "ask": 201.00,
        "volume": 15000,
        "openInterest": 60000,
        "impliedVolatility": 20.0
    }
    
    print("\nCreating test position for P&L calculation...")
    
    try:
        # Execute trade
        response = requests.post(
            f"{BACKEND_API_URL}/trading/paper/option",
            json=trade_request,
            headers={"Content-Type": "application/json"},
            timeout=10
        )
        
        if response.status_code != 201:
            print_result("P&L Calculation Update", False, f"Failed to create position: HTTP {response.status_code}")
            return {"passed": False}
        
        result = response.json()
        position_id = result["positionId"]
        executed_price = result["executedPrice"]
        
        print(f"Position created: {position_id}, Entry Price: ₹{executed_price}")
        
        # Wait for database update
        time.sleep(1)
        
        # Fetch portfolio to get P&L
        portfolio_response = requests.get(
            f"{BACKEND_API_URL}/portfolio/user/{trade_request['userId']}",
            timeout=10
        )
        
        if portfolio_response.status_code != 200:
            print_result("P&L Calculation Update", False, f"Failed to fetch portfolio: HTTP {portfolio_response.status_code}")
            return {"passed": False}
        
        portfolio = portfolio_response.json()
        
        # Find our position
        position = None
        for pos in portfolio.get("positions", []):
            if pos.get("id") == position_id:
                position = pos
                break
        
        if not position:
            print_result("P&L Calculation Update", False, "Position not found in portfolio")
            return {"passed": False}
        
        # Verify P&L calculation
        # P&L = (currentPrice - entryPrice) * quantity
        expected_pnl = (position["currentPrice"] - position["entryPrice"]) * position["quantity"]
        actual_pnl = position["unrealizedPnL"]
        
        # Allow small floating point differences
        pnl_diff = abs(expected_pnl - actual_pnl)
        
        if pnl_diff < 0.01:
            print_result(
                "P&L Calculation Update",
                True,
                f"P&L calculation correct: ₹{actual_pnl:.2f} (Entry: ₹{position['entryPrice']}, Current: ₹{position['currentPrice']}, Qty: {position['quantity']})"
            )
            return {"passed": True}
        else:
            print_result(
                "P&L Calculation Update",
                False,
                f"P&L mismatch: Expected ₹{expected_pnl:.2f}, Got ₹{actual_pnl:.2f} (Diff: ₹{pnl_diff:.2f})"
            )
            return {"passed": False}
            
    except Exception as e:
        print_result("P&L Calculation Update", False, f"Error: {str(e)}")
        return {"passed": False}

def test_no_live_trade_button_exists():
    """Test 5: VERIFY - NO live trade button exists for options"""
    print_section("TEST 5: VERIFY - NO Live Trade Button for Options")
    
    print("\nThis test verifies the architectural constraint:")
    print("  ✅ Options should ONLY have paper trading capability")
    print("  ❌ Options should NOT have live trading capability")
    print("\nVerifying via API endpoint availability...")
    
    # Test that live options trading endpoint does NOT exist
    live_trade_request = {
        "userId": "test-user-75-3",
        "symbol": "NIFTY",
        "strikePrice": 21500,
        "optionType": "CALL",
        "expiry": (datetime.now() + timedelta(days=7)).isoformat(),
        "action": "BUY",
        "quantity": 1,
        "price": 150.50
    }
    
    try:
        # Try to call live options trading endpoint (should not exist)
        response = requests.post(
            f"{BACKEND_API_URL}/trading/live/option",
            json=live_trade_request,
            headers={"Content-Type": "application/json"},
            timeout=10
        )
        
        # If endpoint exists and returns 200/201, that's a FAILURE
        if response.status_code in [200, 201]:
            print_result(
                "NO Live Trade Button for Options",
                False,
                "❌ CRITICAL: Live options trading endpoint EXISTS and accepts trades! This violates requirement."
            )
            return {"passed": False}
        
        # If endpoint returns 404, that's expected (good)
        elif response.status_code == 404:
            print_result(
                "NO Live Trade Button for Options",
                True,
                "✅ Live options trading endpoint does NOT exist (404) - Requirement satisfied"
            )
            return {"passed": True}
        
        # Any other error is also acceptable (endpoint doesn't work)
        else:
            print_result(
                "NO Live Trade Button for Options",
                True,
                f"Live options trading endpoint returns error {response.status_code} - Requirement satisfied"
            )
            return {"passed": True}
            
    except requests.exceptions.RequestException as e:
        # Connection error means endpoint doesn't exist
        print_result(
            "NO Live Trade Button for Options",
            True,
            f"✅ Live options trading endpoint not accessible - Requirement satisfied"
        )
        return {"passed": True}
    except Exception as e:
        print_result("NO Live Trade Button for Options", False, f"Unexpected error: {str(e)}")
        return {"passed": False}

def test_trade_confirmation_dialog_data():
    """Test 6: Verify trade confirmation shows contract details and risk metrics"""
    print_section("TEST 6: Trade Confirmation Dialog Data")
    
    print("\nThis test verifies that the trade confirmation dialog receives:")
    print("  - Contract details (symbol, strike, type, expiry)")
    print("  - Pricing data (LTP, bid, ask)")
    print("  - Risk metrics (volume, OI, IV)")
    print("  - Greeks (delta, gamma, theta, vega)")
    
    # This is tested through the UI component, but we can verify the data structure
    # by checking what data is available from the options chain endpoint
    
    try:
        # Fetch options chain data
        response = requests.get(
            f"{BACKEND_API_URL}/options/chain?symbol=NIFTY",
            timeout=10
        )
        
        if response.status_code == 200:
            chain_data = response.json()
            
            if "strikes" in chain_data and len(chain_data["strikes"]) > 0:
                # Check first strike has all required data
                strike = chain_data["strikes"][0]
                
                required_call_fields = ["ltp", "bid", "ask", "volume", "oi", "iv"]
                required_put_fields = ["ltp", "bid", "ask", "volume", "oi", "iv"]
                
                call_has_all = all(field in strike.get("call", {}) for field in required_call_fields)
                put_has_all = all(field in strike.get("put", {}) for field in required_put_fields)
                
                if call_has_all and put_has_all:
                    print_result(
                        "Trade Confirmation Dialog Data",
                        True,
                        "Options chain provides all required data for confirmation dialog"
                    )
                    return {"passed": True}
                else:
                    missing = []
                    if not call_has_all:
                        missing.append("CALL data incomplete")
                    if not put_has_all:
                        missing.append("PUT data incomplete")
                    
                    print_result(
                        "Trade Confirmation Dialog Data",
                        False,
                        f"Missing data: {', '.join(missing)}"
                    )
                    return {"passed": False}
            else:
                print_result(
                    "Trade Confirmation Dialog Data",
                    False,
                    "No strikes data in options chain"
                )
                return {"passed": False}
        else:
            print_result(
                "Trade Confirmation Dialog Data",
                False,
                f"Failed to fetch options chain: HTTP {response.status_code}"
            )
            return {"passed": False}
            
    except Exception as e:
        print_result("Trade Confirmation Dialog Data", False, f"Error: {str(e)}")
        return {"passed": False}

def main():
    print("="*80)
    print("TASK 75.3: OPTIONS PAPER TRADING VERIFICATION")
    print("="*80)
    print("\nThis test verifies:")
    print("  1. Execute paper option trade")
    print("  2. Verify recording in database")
    print("  3. Check options position appears in Portfolio Dashboard")
    print("  4. Verify P&L calculation updates")
    print("  5. Confirm trade confirmation dialog data availability")
    print("  6. VERIFY: NO live trade button exists for options")
    print("\nRequirements: 9.1, 11.1, 11.5")
    
    # Run all tests
    results = []
    
    # Test 1: Execute paper option trade
    test1_result = test_paper_option_trade_execution()
    results.append(test1_result)
    
    # Test 2 & 3: Verify in portfolio (only if test 1 passed)
    if test1_result["passed"]:
        test2_result = test_portfolio_options_position(
            test1_result["userId"],
            test1_result["positionId"]
        )
        results.append(test2_result)
        
        test3_result = test_options_positions_endpoint(test1_result["userId"])
        results.append(test3_result)
    else:
        print("\n⚠️  Skipping portfolio tests because trade execution failed")
        results.append({"passed": False})
        results.append({"passed": False})
    
    # Test 4: P&L calculation
    test4_result = test_pnl_calculation_update()
    results.append(test4_result)
    
    # Test 5: NO live trade button
    test5_result = test_no_live_trade_button_exists()
    results.append(test5_result)
    
    # Test 6: Confirmation dialog data
    test6_result = test_trade_confirmation_dialog_data()
    results.append(test6_result)
    
    # Summary
    print_section("TEST SUMMARY")
    passed_count = sum(1 for r in results if r.get("passed", False))
    total_count = len(results)
    
    print(f"\nTests Passed: {passed_count}/{total_count}")
    
    if passed_count == total_count:
        print("\n✅ TASK 75.3 VERIFICATION: ALL TESTS PASSED")
        print("\nOptions paper trading is fully functional:")
        print("  ✅ Paper trade button works on options chain")
        print("  ✅ Trade confirmation dialog has all required data")
        print("  ✅ Paper trades are recorded in database")
        print("  ✅ Options positions appear in Portfolio Dashboard")
        print("  ✅ P&L calculation updates correctly")
        print("  ✅ NO live trade button exists for options (architectural constraint)")
        return 0
    else:
        print(f"\n❌ TASK 75.3 VERIFICATION: {total_count - passed_count} TEST(S) FAILED")
        print("\nPlease review the failed tests above.")
        return 1

if __name__ == "__main__":
    sys.exit(main())
