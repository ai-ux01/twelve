#!/bin/bash
# Keep Mac awake during Indian market hours (9:00 AM - 4:00 PM IST, Mon-Fri)
# Run this script once and it will manage sleep prevention automatically.
#
# Usage: ./scripts/keep-awake-market-hours.sh
# To stop: kill the process or Ctrl+C

echo "🟢 Market hours keep-awake service started"
echo "   Mac will stay awake Mon-Fri 9:00 AM - 4:00 PM IST"
echo "   Press Ctrl+C to stop"
echo ""

while true; do
    # Get current IST time (UTC+5:30)
    HOUR=$(TZ='Asia/Kolkata' date +%H)
    MINUTE=$(TZ='Asia/Kolkata' date +%M)
    DAY=$(TZ='Asia/Kolkata' date +%u)  # 1=Mon, 7=Sun

    CURRENT_MINUTES=$((HOUR * 60 + MINUTE))
    MARKET_START=$((9 * 60))       # 9:00 AM = 540 min
    MARKET_END=$((16 * 60))        # 4:00 PM = 960 min

    # Check if weekday (Mon-Fri) and within market hours
    if [ "$DAY" -le 5 ] && [ "$CURRENT_MINUTES" -ge "$MARKET_START" ] && [ "$CURRENT_MINUTES" -le "$MARKET_END" ]; then
        echo "$(TZ='Asia/Kolkata' date '+%H:%M:%S IST') - Market hours active, preventing sleep..."
        # caffeinate -s prevents system sleep for 5 minutes, then we re-check
        caffeinate -s -t 300 &
        CAFF_PID=$!
        sleep 300
        kill $CAFF_PID 2>/dev/null
    else
        if [ "$DAY" -gt 5 ]; then
            echo "$(TZ='Asia/Kolkata' date '+%H:%M:%S IST') - Weekend, sleeping allowed. Checking again in 30 min..."
        else
            echo "$(TZ='Asia/Kolkata' date '+%H:%M:%S IST') - Outside market hours, sleeping allowed. Checking again in 10 min..."
        fi
        # Check less frequently outside market hours
        if [ "$DAY" -gt 5 ]; then
            sleep 1800  # 30 min on weekends
        else
            sleep 600   # 10 min outside market hours on weekdays
        fi
    fi
done
