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
# (*Mark.tsx excluded: icon SVG path coordinates such as 7.59.4.07 are not IPs)
check_content() {
    if grep -r -E -I '\b([0-9]{1,3}\.){3}[0-9]{1,3}\b' . --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=lib --exclude-dir=out --exclude-dir=.next --exclude-dir=cache --exclude='check-submission.sh' --exclude='*Mark.tsx' 2>/dev/null | grep -vE '0\.0\.0\.0|127\.0\.0\.1|[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+[a-zA-Z-]' | grep -q .; then
        echo "FAIL: IP address pattern found in repository"
        return 1
    fi
    
    if grep -r "workplane-private" . --exclude-dir=node_modules --exclude-dir=.git --exclude="check-*.sh" >/dev/null 2>&1; then
        echo "FAIL: 'workplane-private' found in repository"
        return 1
    fi
    
    if grep -r "PRIVATE_KEY=" . --exclude-dir=node_modules --exclude-dir=.git --exclude="check-*.sh" >/dev/null 2>&1; then
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

# Live mode check function
check_live_mode() {
    echo "Running live mode checks..."
    
    # URLs to check
    urls=(
        "https://ethplane.ecofrontiers.xyz/"
        "https://ethplane.ecofrontiers.xyz/deck"
        "https://ethplane.ecofrontiers.xyz/docs"
        "https://ethplane.ecofrontiers.xyz/join"
        "https://ethplane.ecofrontiers.xyz/node/0x8e67c816b1f39fa072094b67f4f74937bd1920a7a9d79e4b98e785ae9aa29d58"
        "https://ethplane.ecofrontiers.xyz/api/nodes"
        "https://ethplane.ecofrontiers.xyz/api/nodes/0x8e67c816b1f39fa072094b67f4f74937bd1920a7a9d79e4b98e785ae9aa29d58"
    )
    
    # Check each URL
    for url in "${urls[@]}"; do
        response_code=$(curl -s -o /dev/null -w "%{http_code}" "$url")
        if [ "$response_code" = "200" ]; then
            echo "PASS: $url (HTTP $response_code)"
        else
            echo "FAIL: $url (HTTP $response_code)"
            return 1
        fi
    done
    
    # Check nodes API response
    nodes_response=$(curl -s "https://ethplane.ecofrontiers.xyz/api/nodes")
    node_count=$(echo "$nodes_response" | python3 -c "import sys, json; print(len(json.load(sys.stdin)))")
    if [ "$node_count" -eq 65 ]; then
        echo "PASS: /api/nodes has exactly 65 entries"
    else
        echo "FAIL: /api/nodes has $node_count entries, expected 65"
        return 1
    fi
    
    # Check that at least one node has state 'open'
    has_open_node=$(echo "$nodes_response" | python3 -c "
import sys, json
data = json.load(sys.stdin)
has_open = any(node.get('state') == 'open' for node in data)
print('true' if has_open else 'false')
")
    if [ "$has_open_node" = "true" ]; then
        echo "PASS: At least one node has state 'open'"
    else
        echo "FAIL: No node found with state 'open'"
        return 1
    fi
    
    # Get the specific node data
    node_data=$(curl -s "https://ethplane.ecofrontiers.xyz/api/nodes/0x8e67c816b1f39fa072094b67f4f74937bd1920a7a9d79e4b98e785ae9aa29d58")
    
    # Check submissions length ≥ 2
    submissions_length=$(echo "$node_data" | python3 -c "
import sys, json
data = json.load(sys.stdin)
submissions = data.get('submissions', [])
print(len(submissions))
")
    if [ "$submissions_length" -ge 2 ]; then
        echo "PASS: Node has $submissions_length submissions (≥ 2)"
    else
        echo "FAIL: Node has $submissions_length submissions, expected ≥ 2"
        return 1
    fi
    
    # Check verdicts length ≥ 2
    verdicts_length=$(echo "$node_data" | python3 -c "
import sys, json
data = json.load(sys.stdin)
verdicts = data.get('verdicts', [])
print(len(verdicts))
")
    if [ "$verdicts_length" -ge 2 ]; then
        echo "PASS: Node has $verdicts_length verdicts (≥ 2)"
    else
        echo "FAIL: Node has $verdicts_length verdicts, expected ≥ 2"
        return 1
    fi
    
    return 0
}

# Run checks
all_passed=true

check_file "README.md" || all_passed=false
check_file "ATTRIBUTION.md" || all_passed=false
check_file "LICENSE" || all_passed=false
check_file "docs/SPEC.md" || all_passed=false
check_file "docs/CRITERION-pq-leanxmss.md" || all_passed=false
check_file "docs/DEPLOYMENTS.md" || all_passed=false

check_content || all_passed=false

# Handle --live flag
if [ "$1" = "--live" ]; then
    check_live_mode || all_passed=false
fi

if [ "$all_passed" = true ]; then
    echo "All checks passed"
    exit 0
else
    echo "Some checks failed"
    exit 1
fi