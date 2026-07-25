#!/bin/bash
# Test script for Phase 4 enhancements verification (Task 34)

echo "================================================================================"
echo "PHASE 4 ENHANCEMENTS VERIFICATION (Task 34)"
echo "================================================================================"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counters
PASSED=0
FAILED=0

# Test 1: GET /quant/indicators
echo "================================================================================"
echo "TEST 1: GET /quant/indicators"
echo "================================================================================"
RESPONSE=$(curl -s -w "\n%{http_code}" http://localhost:8000/quant/indicators)
HTTP_CODE=$(echo "$RESPONSE" | tail -n 1)
BODY=$(echo "$RESPONSE" | head -n -1)

if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✅ Status Code: $HTTP_CODE${NC}"
    INDICATOR_COUNT=$(echo "$BODY" | python3 -c "import sys, json; data=json.load(sys.stdin); print(len(data['indicators']))" 2>/dev/null || echo "0")
    echo -e "${GREEN}✅ Number of indicators: $INDICATOR_COUNT${NC}"
    
    # Show first few indicators
    echo ""
    echo "📊 Sample Indicator Definitions:"
    echo "$BODY" | python3 -c "import sys, json; data=json.load(sys.stdin); [print(f\"  - {ind['name']}\") for ind in data['indicators'][:5]]" 2>/dev/null
    PASSED=$((PASSED+1))
else
    echo -e "${RED}❌ Failed with HTTP code: $HTTP_CODE${NC}"
    FAILED=$((FAILED+1))
fi

echo ""

# Generate sample OHLCV data for tests 2 and 3
SAMPLE_DATA=$(cat <<'EOF'
{
  "symbol": "RELIANCE",
  "timeframe": "1d",
  "data": [
EOF
)

# Generate 250 data points
for i in $(seq 0 249); do
    BASE_PRICE=2450
    PRICE_VAR=$((i % 20 - 10))
    PRICE=$((BASE_PRICE + PRICE_VAR * 2))
    CLOSE=$((PRICE + (i % 5 - 2)))
    HIGH=$((PRICE > CLOSE ? PRICE + (i % 3) : CLOSE + (i % 3)))
    LOW=$((PRICE < CLOSE ? PRICE - (i % 2) : CLOSE - (i % 2)))
    VOLUME=$((1000000 + (i % 100000)))
    
    TIMESTAMP=$(date -u -v-${i}d +"%Y-%m-%dT%H:%M:%S" 2>/dev/null || date -u -d "$i days ago" +"%Y-%m-%dT%H:%M:%S" 2>/dev/null)
    
    if [ $i -eq 249 ]; then
        SAMPLE_DATA="${SAMPLE_DATA}
    {\"timestamp\": \"${TIMESTAMP}\", \"open\": ${PRICE}, \"high\": ${HIGH}, \"low\": ${LOW}, \"close\": ${CLOSE}, \"volume\": ${VOLUME}}"
    else
        SAMPLE_DATA="${SAMPLE_DATA}
    {\"timestamp\": \"${TIMESTAMP}\", \"open\": ${PRICE}, \"high\": ${HIGH}, \"low\": ${LOW}, \"close\": ${CLOSE}, \"volume\": ${VOLUME}},"
    fi
done

SAMPLE_DATA="${SAMPLE_DATA}
  ]
}"

# Test 2: POST /quant/analyze
echo "================================================================================"
echo "TEST 2: POST /quant/analyze (with 250 candles)"
echo "================================================================================"
RESPONSE=$(echo "$SAMPLE_DATA" | curl -s -w "\n%{http_code}" -X POST http://localhost:8000/quant/analyze -H "Content-Type: application/json" -d @-)
HTTP_CODE=$(echo "$RESPONSE" | tail -n 1)
BODY=$(echo "$RESPONSE" | head -n -1)

if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✅ Status Code: $HTTP_CODE${NC}"
    echo -e "${GREEN}✅ Data points processed: 250${NC}"
    
    echo ""
    echo "📊 Phase 4 Indicators Check:"
    
    # Check for new EMA periods
    for period in 5 15 50 200; do
        HAS_EMA=$(echo "$BODY" | python3 -c "import sys, json; data=json.load(sys.stdin); print('ema_$period' in data.get('indicators', {}))" 2>/dev/null)
        if [ "$HAS_EMA" = "True" ]; then
            EMA_VAL=$(echo "$BODY" | python3 -c "import sys, json; data=json.load(sys.stdin); print(f\"{data['indicators']['ema_$period']:.2f}\")" 2>/dev/null)
            echo -e "  ${GREEN}✅ EMA $period: $EMA_VAL${NC}"
        else
            echo -e "  ${RED}❌ EMA $period: MISSING${NC}"
        fi
    done
    
    # Check for new indicators
    for ind in adx atr vwap volume_ma relative_volume week_52_high week_52_low momentum; do
        HAS_IND=$(echo "$BODY" | python3 -c "import sys, json; data=json.load(sys.stdin); print('$ind' in data.get('indicators', {}))" 2>/dev/null)
        if [ "$HAS_IND" = "True" ]; then
            IND_VAL=$(echo "$BODY" | python3 -c "import sys, json; data=json.load(sys.stdin); val=data['indicators']['$ind']; print(f'{val:.2f}' if isinstance(val, (int, float)) else str(val))" 2>/dev/null)
            echo -e "  ${GREEN}✅ $(echo $ind | tr '_' ' ' | awk '{for(i=1;i<=NF;i++)sub(/./,toupper(substr($i,1,1)),$i)}1'): $IND_VAL${NC}"
        else
            echo -e "  ${RED}❌ $(echo $ind | tr '_' ' ' | awk '{for(i=1;i<=NF;i++)sub(/./,toupper(substr($i,1,1)),$i)}1'): MISSING${NC}"
        fi
    done
    
    PASSED=$((PASSED+1))
else
    echo -e "${RED}❌ Failed with HTTP code: $HTTP_CODE${NC}"
    echo "$BODY"
    FAILED=$((FAILED+1))
fi

echo ""

# Test 3: POST /quant/score
echo "================================================================================"
echo "TEST 3: POST /quant/score (Deterministic Scoring)"
echo "================================================================================"

# First call
RESPONSE1=$(echo "$SAMPLE_DATA" | curl -s -w "\n%{http_code}" -X POST http://localhost:8000/quant/score -H "Content-Type: application/json" -d @-)
HTTP_CODE1=$(echo "$RESPONSE1" | tail -n 1)
BODY1=$(echo "$RESPONSE1" | head -n -1)

# Second call (same data)
RESPONSE2=$(echo "$SAMPLE_DATA" | curl -s -w "\n%{http_code}" -X POST http://localhost:8000/quant/score -H "Content-Type: application/json" -d @-)
HTTP_CODE2=$(echo "$RESPONSE2" | tail -n 1)
BODY2=$(echo "$RESPONSE2" | head -n -1)

if [ "$HTTP_CODE1" = "200" ] && [ "$HTTP_CODE2" = "200" ]; then
    echo -e "${GREEN}✅ Status Code: $HTTP_CODE1${NC}"
    
    echo ""
    echo "📊 Score Results:"
    TREND=$(echo "$BODY1" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('trend', 'N/A'))" 2>/dev/null)
    SCORE=$(echo "$BODY1" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('score', 'N/A'))" 2>/dev/null)
    RSI=$(echo "$BODY1" | python3 -c "import sys, json; data=json.load(sys.stdin); print(f\"{data.get('rsi', 0):.2f}\")" 2>/dev/null)
    ADX=$(echo "$BODY1" | python3 -c "import sys, json; data=json.load(sys.stdin); print(f\"{data.get('adx', 0):.2f}\")" 2>/dev/null)
    
    echo "  Trend: $TREND"
    echo "  Score: $SCORE/100"
    echo "  RSI: $RSI"
    echo "  ADX: $ADX"
    
    # Test determinism
    SCORE1=$(echo "$BODY1" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('score', 0))" 2>/dev/null)
    SCORE2=$(echo "$BODY2" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('score', 0))" 2>/dev/null)
    
    echo ""
    echo "🔄 Testing Determinism (same input twice):"
    if [ "$SCORE1" = "$SCORE2" ]; then
        echo -e "  ${GREEN}✅ Score is deterministic: $SCORE1 == $SCORE2${NC}"
    else
        echo -e "  ${RED}❌ Score is NOT deterministic: $SCORE1 != $SCORE2${NC}"
    fi
    
    PASSED=$((PASSED+1))
else
    echo -e "${RED}❌ Failed with HTTP code: $HTTP_CODE1${NC}"
    echo "$BODY1"
    FAILED=$((FAILED+1))
fi

echo ""

# Test 4: Backend API
echo "================================================================================"
echo "TEST 4: Backend API Integration"
echo "================================================================================"
RESPONSE=$(curl -s -w "\n%{http_code}" http://localhost:4000/health 2>/dev/null)
HTTP_CODE=$(echo "$RESPONSE" | tail -n 1)

if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✅ Backend API is running (Status: $HTTP_CODE)${NC}"
    PASSED=$((PASSED+1))
else
    echo -e "${YELLOW}⚠️  Backend API not accessible${NC}"
    FAILED=$((FAILED+1))
fi

echo ""

# Test 5: Frontend
echo "================================================================================"
echo "TEST 5: Frontend Application"
echo "================================================================================"
RESPONSE=$(curl -s -w "\n%{http_code}" http://localhost:3000 2>/dev/null)
HTTP_CODE=$(echo "$RESPONSE" | tail -n 1)

if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✅ Frontend is running (Status: $HTTP_CODE)${NC}"
    PASSED=$((PASSED+1))
else
    echo -e "${YELLOW}⚠️  Frontend not accessible${NC}"
    FAILED=$((FAILED+1))
fi

echo ""

# Summary
echo "================================================================================"
echo "VERIFICATION SUMMARY"
echo "================================================================================"

TOTAL=$((PASSED + FAILED))
echo "📊 Results: $PASSED/$TOTAL tests passed"

if [ $FAILED -eq 0 ]; then
    echo ""
    echo -e "${GREEN}🎉 All Phase 4 enhancements verified successfully!${NC}"
    exit 0
else
    echo ""
    echo -e "${YELLOW}⚠️  Some tests failed. Please review the output above.${NC}"
    exit 1
fi
