"""
Signal Forwarder Module for the Quant Engine.

Intercepts analysis results from signal sources (Options Scalper, Swing Scanner,
Intraday Scorer), evaluates them against configurable thresholds, suppresses
duplicates, and forwards qualifying signals to the Paper Trading API.
"""
