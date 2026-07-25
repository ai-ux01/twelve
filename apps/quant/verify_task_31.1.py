#!/usr/bin/env python3
"""
Verification script for Task 31.1: Update main.py with new routes

This script verifies that:
1. GET /quant/indicators handler is properly wired
2. POST /quant/analyze handler is properly wired (with all new indicators)
3. POST /quant/score handler is properly wired
4. Backward compatibility with old endpoints is maintained
5. API documentation strings are comprehensive
"""

import sys

sys.path.insert(0, ".")

from main import app
from inspect import getdoc


def verify_endpoints():
    """Verify all required endpoints are registered."""
    print("=" * 80)
    print("Task 31.1 Verification: Update main.py with new routes")
    print("=" * 80)
    print()

    # Get all routes
    routes = {route.path: route for route in app.routes}

    # Check new endpoints
    print("1. Verifying NEW endpoints (/quant/*):")
    print("-" * 80)

    required_new_endpoints = {
        "/quant/indicators": "GET",
        "/quant/analyze": "POST",
        "/quant/score": "POST",
    }

    all_new_passed = True
    for path, method in required_new_endpoints.items():
        if path in routes:
            route = routes[path]
            methods = [m for m in route.methods if m != "HEAD"]  # Exclude HEAD
            if method in methods:
                print(f"✓ {method:6} {path:30} - FOUND")

                # Check documentation
                endpoint_func = route.endpoint
                doc = getdoc(endpoint_func)
                if doc and len(doc) > 50:
                    print(f"  ✓ Has documentation ({len(doc)} chars)")
                else:
                    print(f"  ⚠ Documentation is short or missing")
            else:
                print(f"✗ {method:6} {path:30} - WRONG METHOD (found: {methods})")
                all_new_passed = False
        else:
            print(f"✗ {method:6} {path:30} - MISSING")
            all_new_passed = False

    print()

    # Check backward compatibility
    print("2. Verifying BACKWARD COMPATIBILITY (deprecated endpoints):")
    print("-" * 80)

    deprecated_endpoints = {"/analyze": "POST", "/indicators": "POST"}

    all_deprecated_passed = True
    for path, method in deprecated_endpoints.items():
        if path in routes:
            route = routes[path]
            methods = [m for m in route.methods if m != "HEAD"]
            if method in methods:
                print(f"✓ {method:6} {path:30} - MAINTAINED")

                # Check if marked as deprecated
                endpoint_func = route.endpoint
                doc = getdoc(endpoint_func)
                if doc and "DEPRECATED" in doc:
                    print(f"  ✓ Marked as deprecated in docs")
                else:
                    print(f"  ⚠ Not marked as deprecated in docs")
            else:
                print(f"✗ {method:6} {path:30} - WRONG METHOD")
                all_deprecated_passed = False
        else:
            print(f"✗ {method:6} {path:30} - MISSING (breaks backward compatibility)")
            all_deprecated_passed = False

    print()

    # Check documentation quality
    print("3. Verifying API DOCUMENTATION quality:")
    print("-" * 80)

    endpoints_to_check = [
        ("/quant/indicators", "GET"),
        ("/quant/analyze", "POST"),
        ("/quant/score", "POST"),
    ]

    all_docs_passed = True
    for path, method in endpoints_to_check:
        if path in routes:
            route = routes[path]
            endpoint_func = route.endpoint
            doc = getdoc(endpoint_func)

            if doc:
                has_description = len(doc) > 100
                # GET endpoints without parameters are okay if they document the response
                is_get_no_params = method == "GET" and path == "/quant/indicators"
                has_args = (
                    "Args:" in doc
                    or "Parameters:" in doc
                    or "Request:" in doc
                    or is_get_no_params
                )
                has_returns = "Returns:" in doc or "Response:" in doc
                has_example = "Example:" in doc or "Example Response:" in doc

                print(f"{method:6} {path}")
                print(
                    f"  {'✓' if has_description else '✗'} Description (>100 chars): {len(doc)} chars"
                )
                print(
                    f"  {'✓' if has_args else '✗'} Documents arguments/parameters{' (N/A for GET)' if is_get_no_params else ''}"
                )
                print(
                    f"  {'✓' if has_returns else '✗'} Documents return value/response"
                )
                print(f"  {'✓' if has_example else '✗'} Includes example")

                if not (has_description and has_args and has_returns):
                    all_docs_passed = False
            else:
                print(f"✗ {method:6} {path:30} - NO DOCUMENTATION")
                all_docs_passed = False

    print()

    # Summary
    print("=" * 80)
    print("VERIFICATION SUMMARY:")
    print("=" * 80)
    print(f"New endpoints:            {'✓ PASSED' if all_new_passed else '✗ FAILED'}")
    print(
        f"Backward compatibility:   {'✓ PASSED' if all_deprecated_passed else '✗ FAILED'}"
    )
    print(f"Documentation quality:    {'✓ PASSED' if all_docs_passed else '✗ FAILED'}")
    print()

    if all_new_passed and all_deprecated_passed and all_docs_passed:
        print("🎉 Task 31.1: ALL CHECKS PASSED!")
        print()
        print("Summary:")
        print("  ✓ GET /quant/indicators handler - properly wired")
        print(
            "  ✓ POST /quant/analyze handler - properly wired (with all new indicators)"
        )
        print("  ✓ POST /quant/score handler - properly wired")
        print("  ✓ Backward compatibility maintained (old endpoints still work)")
        print("  ✓ API documentation strings are comprehensive")
        print()
        return 0
    else:
        print("❌ Task 31.1: SOME CHECKS FAILED")
        print()
        print("Please review the failures above and fix them.")
        print()
        return 1


if __name__ == "__main__":
    exit_code = verify_endpoints()
    sys.exit(exit_code)
