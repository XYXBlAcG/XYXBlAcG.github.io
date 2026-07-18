#include <cstdio>
#include <vector>
#include <algorithm>
#include <iostream>
#include <cmath>
#include <cstring>

std::vector<int> v;
int n;

int main(){
    scanf("%d", &n);
    for (int i = 1, x; i <= n; i++) {
        scanf("%d", &x);
        v.push_back(x);
    }
    std::sort(v.begin(), v.end());
    for (int i = 0; i < n; i++) {
        printf("%d ", v[i]);
    }

    printf("\n");
    return 0;
}