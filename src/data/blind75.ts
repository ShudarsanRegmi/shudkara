export interface LeetCodeQuestion {
  id: string;
  title: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  category: string;
  url: string;
}

export const BLIND75_QUESTIONS: LeetCodeQuestion[] = [
  // Array & Hashing
  { id: '1', title: 'Two Sum', difficulty: 'Easy', category: 'Array & Hashing', url: 'https://leetcode.com/problems/two-sum/' },
  { id: '121', title: 'Best Time to Buy and Sell Stock', difficulty: 'Easy', category: 'Array & Hashing', url: 'https://leetcode.com/problems/best-time-to-buy-and-sell-stock/' },
  { id: '217', title: 'Contains Duplicate', difficulty: 'Easy', category: 'Array & Hashing', url: 'https://leetcode.com/problems/contains-duplicate/' },
  { id: '238', title: 'Product of Array Except Self', difficulty: 'Medium', category: 'Array & Hashing', url: 'https://leetcode.com/problems/product-of-array-except-self/' },
  { id: '53', title: 'Maximum Subarray', difficulty: 'Medium', category: 'Array & Hashing', url: 'https://leetcode.com/problems/maximum-subarray/' },
  { id: '152', title: 'Maximum Product Subarray', difficulty: 'Medium', category: 'Array & Hashing', url: 'https://leetcode.com/problems/maximum-product-subarray/' },
  { id: '153', title: 'Find Minimum in Rotated Sorted Array', difficulty: 'Medium', category: 'Array & Hashing', url: 'https://leetcode.com/problems/find-minimum-in-rotated-sorted-array/' },
  { id: '33', title: 'Search in Rotated Sorted Array', difficulty: 'Medium', category: 'Array & Hashing', url: 'https://leetcode.com/problems/search-in-rotated-sorted-array/' },
  { id: '15', title: '3Sum', difficulty: 'Medium', category: 'Array & Hashing', url: 'https://leetcode.com/problems/3sum/' },
  { id: '11', title: 'Container With Most Water', difficulty: 'Medium', category: 'Array & Hashing', url: 'https://leetcode.com/problems/container-with-most-water/' },

  // Binary
  { id: '371', title: 'Sum of Two Integers', difficulty: 'Medium', category: 'Binary', url: 'https://leetcode.com/problems/sum-of-two-integers/' },
  { id: '191', title: 'Number of 1 Bits', difficulty: 'Easy', category: 'Binary', url: 'https://leetcode.com/problems/number-of-1-bits/' },
  { id: '338', title: 'Counting Bits', difficulty: 'Easy', category: 'Binary', url: 'https://leetcode.com/problems/counting-bits/' },
  { id: '268', title: 'Missing Number', difficulty: 'Easy', category: 'Binary', url: 'https://leetcode.com/problems/missing-number/' },
  { id: '190', title: 'Reverse Bits', difficulty: 'Easy', category: 'Binary', url: 'https://leetcode.com/problems/reverse-bits/' },

  // Dynamic Programming
  { id: '70', title: 'Climbing Stairs', difficulty: 'Easy', category: 'Dynamic Programming', url: 'https://leetcode.com/problems/climbing-stairs/' },
  { id: '322', title: 'Coin Change', difficulty: 'Medium', category: 'Dynamic Programming', url: 'https://leetcode.com/problems/coin-change/' },
  { id: '300', title: 'Longest Increasing Subsequence', difficulty: 'Medium', category: 'Dynamic Programming', url: 'https://leetcode.com/problems/longest-increasing-subsequence/' },
  { id: '1143', title: 'Longest Common Subsequence', difficulty: 'Medium', category: 'Dynamic Programming', url: 'https://leetcode.com/problems/longest-common-subsequence/' },
  { id: '139', title: 'Word Break', difficulty: 'Medium', category: 'Dynamic Programming', url: 'https://leetcode.com/problems/word-break/' },
  { id: '377', title: 'Combination Sum IV', difficulty: 'Medium', category: 'Dynamic Programming', url: 'https://leetcode.com/problems/combination-sum-iv/' },
  { id: '198', title: 'House Robber', difficulty: 'Medium', category: 'Dynamic Programming', url: 'https://leetcode.com/problems/house-robber/' },
  { id: '213', title: 'House Robber II', difficulty: 'Medium', category: 'Dynamic Programming', url: 'https://leetcode.com/problems/house-robber-ii/' },
  { id: '91', title: 'Decode Ways', difficulty: 'Medium', category: 'Dynamic Programming', url: 'https://leetcode.com/problems/decode-ways/' },
  { id: '62', title: 'Unique Paths', difficulty: 'Medium', category: 'Dynamic Programming', url: 'https://leetcode.com/problems/unique-paths/' },
  { id: '55', title: 'Jump Game', difficulty: 'Medium', category: 'Dynamic Programming', url: 'https://leetcode.com/problems/jump-game/' },

  // Graph
  { id: '133', title: 'Clone Graph', difficulty: 'Medium', category: 'Graph', url: 'https://leetcode.com/problems/clone-graph/' },
  { id: '207', title: 'Course Schedule', difficulty: 'Medium', category: 'Graph', url: 'https://leetcode.com/problems/course-schedule/' },
  { id: '417', title: 'Pacific Atlantic Water Flow', difficulty: 'Medium', category: 'Graph', url: 'https://leetcode.com/problems/pacific-atlantic-water-flow/' },
  { id: '200', title: 'Number of Islands', difficulty: 'Medium', category: 'Graph', url: 'https://leetcode.com/problems/number-of-islands/' },
  { id: '128', title: 'Longest Consecutive Sequence', difficulty: 'Medium', category: 'Graph', url: 'https://leetcode.com/problems/longest-consecutive-sequence/' },
  { id: '269', title: 'Alien Dictionary', difficulty: 'Hard', category: 'Graph', url: 'https://leetcode.com/problems/alien-dictionary/' },
  { id: '261', title: 'Graph Valid Tree', difficulty: 'Medium', category: 'Graph', url: 'https://leetcode.com/problems/graph-valid-tree/' },
  { id: '323', title: 'Number of Connected Components in an Undirected Graph', difficulty: 'Medium', category: 'Graph', url: 'https://leetcode.com/problems/number-of-connected-components-in-an-undirected-graph/' },

  // Interval
  { id: '57', title: 'Insert Interval', difficulty: 'Medium', category: 'Interval', url: 'https://leetcode.com/problems/insert-interval/' },
  { id: '56', title: 'Merge Intervals', difficulty: 'Medium', category: 'Interval', url: 'https://leetcode.com/problems/merge-intervals/' },
  { id: '435', title: 'Non-overlapping Intervals', difficulty: 'Medium', category: 'Interval', url: 'https://leetcode.com/problems/non-overlapping-intervals/' },
  { id: '252', title: 'Meeting Rooms', difficulty: 'Easy', category: 'Interval', url: 'https://leetcode.com/problems/meeting-rooms/' },
  { id: '253', title: 'Meeting Rooms II', difficulty: 'Medium', category: 'Interval', url: 'https://leetcode.com/problems/meeting-rooms-ii/' },

  // Linked List
  { id: '206', title: 'Reverse Linked List', difficulty: 'Easy', category: 'Linked List', url: 'https://leetcode.com/problems/reverse-linked-list/' },
  { id: '141', title: 'Linked List Cycle', difficulty: 'Easy', category: 'Linked List', url: 'https://leetcode.com/problems/linked-list-cycle/' },
  { id: '21', title: 'Merge Two Sorted Lists', difficulty: 'Easy', category: 'Linked List', url: 'https://leetcode.com/problems/merge-two-sorted-lists/' },
  { id: '23', title: 'Merge k Sorted Lists', difficulty: 'Hard', category: 'Linked List', url: 'https://leetcode.com/problems/merge-k-sorted-lists/' },
  { id: '19', title: 'Remove Nth Node From End of List', difficulty: 'Medium', category: 'Linked List', url: 'https://leetcode.com/problems/remove-nth-node-from-end-of-list/' },
  { id: '143', title: 'Reorder List', difficulty: 'Medium', category: 'Linked List', url: 'https://leetcode.com/problems/reorder-list/' },

  // Matrix
  { id: '73', title: 'Set Matrix Zeroes', difficulty: 'Medium', category: 'Matrix', url: 'https://leetcode.com/problems/set-matrix-zeroes/' },
  { id: '54', title: 'Spiral Matrix', difficulty: 'Medium', category: 'Matrix', url: 'https://leetcode.com/problems/spiral-matrix/' },
  { id: '48', title: 'Rotate Image', difficulty: 'Medium', category: 'Matrix', url: 'https://leetcode.com/problems/rotate-image/' },
  { id: '79', title: 'Word Search', difficulty: 'Medium', category: 'Matrix', url: 'https://leetcode.com/problems/word-search/' },

  // String
  { id: '3', title: 'Longest Substring Without Repeating Characters', difficulty: 'Medium', category: 'String', url: 'https://leetcode.com/problems/longest-substring-without-repeating-characters/' },
  { id: '424', title: 'Longest Repeating Character Replacement', difficulty: 'Medium', category: 'String', url: 'https://leetcode.com/problems/longest-repeating-character-replacement/' },
  { id: '76', title: 'Minimum Window Substring', difficulty: 'Hard', category: 'String', url: 'https://leetcode.com/problems/minimum-window-substring/' },
  { id: '242', title: 'Valid Anagram', difficulty: 'Easy', category: 'String', url: 'https://leetcode.com/problems/valid-anagram/' },
  { id: '49', title: 'Group Anagrams', difficulty: 'Medium', category: 'String', url: 'https://leetcode.com/problems/group-anagrams/' },
  { id: '20', title: 'Valid Parentheses', difficulty: 'Easy', category: 'String', url: 'https://leetcode.com/problems/valid-parentheses/' },
  { id: '125', title: 'Valid Palindrome', difficulty: 'Easy', category: 'String', url: 'https://leetcode.com/problems/valid-palindrome/' },
  { id: '5', title: 'Longest Palindromic Substring', difficulty: 'Medium', category: 'String', url: 'https://leetcode.com/problems/longest-palindromic-substring/' },
  { id: '647', title: 'Palindromic Substrings', difficulty: 'Medium', category: 'String', url: 'https://leetcode.com/problems/palindromic-substrings/' },

  // Tree
  { id: '104', title: 'Maximum Depth of Binary Tree', difficulty: 'Easy', category: 'Tree', url: 'https://leetcode.com/problems/maximum-depth-of-binary-tree/' },
  { id: '100', title: 'Same Tree', difficulty: 'Easy', category: 'Tree', url: 'https://leetcode.com/problems/same-tree/' },
  { id: '226', title: 'Invert Binary Tree', difficulty: 'Easy', category: 'Tree', url: 'https://leetcode.com/problems/invert-binary-tree/' },
  { id: '124', title: 'Binary Tree Maximum Path Sum', difficulty: 'Hard', category: 'Tree', url: 'https://leetcode.com/problems/binary-tree-maximum-path-sum/' },
  { id: '102', title: 'Binary Tree Level Order Traversal', difficulty: 'Medium', category: 'Tree', url: 'https://leetcode.com/problems/binary-tree-level-order-traversal/' },
  { id: '297', title: 'Serialize and Deserialize Binary Tree', difficulty: 'Hard', category: 'Tree', url: 'https://leetcode.com/problems/serialize-and-deserialize-binary-tree/' },
  { id: '572', title: 'Subtree of Another Tree', difficulty: 'Easy', category: 'Tree', url: 'https://leetcode.com/problems/subtree-of-another-tree/' },
  { id: '105', title: 'Construct Binary Tree from Preorder and Inorder Traversal', difficulty: 'Medium', category: 'Tree', url: 'https://leetcode.com/problems/construct-binary-tree-from-preorder-and-inorder-traversal/' },
  { id: '98', title: 'Validate Binary Search Tree', difficulty: 'Medium', category: 'Tree', url: 'https://leetcode.com/problems/validate-binary-search-tree/' },
  { id: '230', title: 'Kth Smallest Element in a BST', difficulty: 'Medium', category: 'Tree', url: 'https://leetcode.com/problems/kth-smallest-element-in-a-bst/' },
  { id: '235', title: 'Lowest Common Ancestor of a Binary Search Tree', difficulty: 'Easy', category: 'Tree', url: 'https://leetcode.com/problems/lowest-common-ancestor-of-a-binary-search-tree/' },
  { id: '208', title: 'Implement Trie (Prefix Tree)', difficulty: 'Medium', category: 'Tree', url: 'https://leetcode.com/problems/implement-trie-prefix-tree/' },
  { id: '211', title: 'Design Add and Search Words Data Structure', difficulty: 'Medium', category: 'Tree', url: 'https://leetcode.com/problems/design-add-and-search-words-data-structure/' },
  { id: '212', title: 'Word Search II', difficulty: 'Hard', category: 'Tree', url: 'https://leetcode.com/problems/word-search-ii/' },

  // Heap
  { id: '347', title: 'Top K Frequent Elements', difficulty: 'Medium', category: 'Heap', url: 'https://leetcode.com/problems/top-k-frequent-elements/' },
  { id: '295', title: 'Find Median from Data Stream', difficulty: 'Hard', category: 'Heap', url: 'https://leetcode.com/problems/find-median-from-data-stream/' }
];
