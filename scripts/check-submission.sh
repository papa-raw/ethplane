#!/bin/bash

echo "Running submission check..."

# Check if all required files exist
check_file() {
    if [ ! -f "$1" ]; then
        echo "FAIL: $1 not found"
        return 1
    fi
    echo "PASS: $1 found"
    return 0
}

# Check for IP address patterns or private key references
check_content() {
    if grep -r -E -I '\b([0-9]{1,3}\.){3}[0-9]{1,3}\b' . --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=lib --exclude-dir=out --exclude-dir=.next --exclude-dir=cache --exclude='check-submission.sh' 2>/dev/null | grep -vE '0\.0\.0\.0|127\.0\.0\.1|[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+[a-zA-Z-]' | grep -q .; then
        echo "FAIL: IP address pattern found in repository"
        return 1
    fi
    
    if grep -r "workplane-private" . --exclude-dir=node_modules --exclude-dir=.git --exclude="check-submission.sh" >/dev/null 2>&1; then
        echo "FAIL: 'workplane-private' found in repository"
        return 1
    fi
    
    if grep -r "PRIVATE_KEY=" . --exclude-dir=node_modules --exclude-dir=.git --exclude="check-submission.sh" >/dev/null 2>&1; then
        echo "FAIL: 'PRIVATE_KEY=' found in repository"
        return 1
    fi
    
    echo "PASS: No sensitive content found"
    return 0
}

# Check bash syntax
echo "Checking bash syntax..."
if ! bash -n "$0"; then
    echo "FAIL: Bash syntax error in script"
    exit 1
fi
echo "PASS: Bash syntax OK"

# Run checks
all_passed=true

check_file "README.md" || all_passed=false
check_file "ATTRIBUTION.md" || all_passed=false
check_file "LICENSE" || all_passed=false
check_file "docs/SPEC.md" || all_passed=false
check_file "docs/CRITERION-pq-leanxmss.md" || all_passed=false
check_file "docs/DEPLOYMENTS.md" || all_passed=false

check_content || all_passed=false

if [ "$all_passed" = true ]; then
    echo "All checks passed"
    exit 0
else
    echo "Some checks failed"
    exit 1
fi