def count_arrangements(n):
    # Create a list to store previously computed results
    dp = [0] * (n + 1)
    dp[0] = 1  # Base case: empty tree
    
    # Iterate over each possible number of nodes
    for i in range(1, n + 1):
        # Calculate arrangements for the current number of nodes
        for j in range(min(5, i + 1)):
            dp[i] += dp[i - j - 1]
    
    return dp[n]

if __name__ == "__main__":
    n = int(input("Enter the number of nodes (n): "))
    arrangements = count_arrangements(n)
    print(f"There are {arrangements} possible arrangements.")
