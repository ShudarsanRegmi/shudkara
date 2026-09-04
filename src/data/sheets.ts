import { BLIND75_QUESTIONS, type LeetCodeQuestion } from './blind75';

export type { LeetCodeQuestion };

export interface SheetDefinition {
  id: string;
  title: string;
  badge: string;
  description: string;
  questions: LeetCodeQuestion[];
}

export const AZ_SOUMIKA_QUESTIONS: LeetCodeQuestion[] = [
  // ── Amazon High-Frequency Priority (Top 20) ──
  { id: '1', title: 'Two Sum', difficulty: 'Easy', category: 'Amazon High-Frequency Priority', url: 'https://leetcode.com/problems/two-sum/' },
  { id: '53', title: 'Maximum Subarray', difficulty: 'Medium', category: 'Amazon High-Frequency Priority', url: 'https://leetcode.com/problems/maximum-subarray/' },
  { id: '33', title: 'Search in Rotated Sorted Array', difficulty: 'Medium', category: 'Amazon High-Frequency Priority', url: 'https://leetcode.com/problems/search-in-rotated-sorted-array/' },
  { id: '15', title: '3Sum', difficulty: 'Medium', category: 'Amazon High-Frequency Priority', url: 'https://leetcode.com/problems/3sum/' },
  { id: '42', title: 'Trapping Rain Water', difficulty: 'Hard', category: 'Amazon High-Frequency Priority', url: 'https://leetcode.com/problems/trapping-rain-water/' },
  { id: '347', title: 'Top K Frequent Elements', difficulty: 'Medium', category: 'Amazon High-Frequency Priority', url: 'https://leetcode.com/problems/top-k-frequent-elements/' },
  { id: '767', title: 'Reorganize String', difficulty: 'Medium', category: 'Amazon High-Frequency Priority', url: 'https://leetcode.com/problems/reorganize-string/' },
  { id: '402', title: 'Remove K Digits', difficulty: 'Medium', category: 'Amazon High-Frequency Priority', url: 'https://leetcode.com/problems/remove-k-digits/' },
  { id: '739', title: 'Daily Temperatures', difficulty: 'Medium', category: 'Amazon High-Frequency Priority', url: 'https://leetcode.com/problems/daily-temperatures/' },
  { id: '139', title: 'Word Break', difficulty: 'Medium', category: 'Amazon High-Frequency Priority', url: 'https://leetcode.com/problems/word-break/' },
  { id: '424', title: 'Longest Repeating Character Replacement', difficulty: 'Medium', category: 'Amazon High-Frequency Priority', url: 'https://leetcode.com/problems/longest-repeating-character-replacement/' },
  { id: '994', title: 'Rotting Oranges', difficulty: 'Medium', category: 'Amazon High-Frequency Priority', url: 'https://leetcode.com/problems/rotting-oranges/' },
  { id: '200', title: 'Number of Islands', difficulty: 'Medium', category: 'Amazon High-Frequency Priority', url: 'https://leetcode.com/problems/number-of-islands/' },
  { id: '127', title: 'Word Ladder', difficulty: 'Hard', category: 'Amazon High-Frequency Priority', url: 'https://leetcode.com/problems/word-ladder/' },
  { id: '236', title: 'Lowest Common Ancestor of a Binary Tree', difficulty: 'Medium', category: 'Amazon High-Frequency Priority', url: 'https://leetcode.com/problems/lowest-common-ancestor-of-a-binary-tree/' },
  { id: '543', title: 'Diameter of Binary Tree', difficulty: 'Easy', category: 'Amazon High-Frequency Priority', url: 'https://leetcode.com/problems/diameter-of-binary-tree/' },
  { id: '98', title: 'Validate Binary Search Tree', difficulty: 'Medium', category: 'Amazon High-Frequency Priority', url: 'https://leetcode.com/problems/validate-binary-search-tree/' },
  { id: '114', title: 'Flatten Binary Tree to Linked List', difficulty: 'Medium', category: 'Amazon High-Frequency Priority', url: 'https://leetcode.com/problems/flatten-binary-tree-to-linked-list/' },
  { id: '72', title: 'Edit Distance', difficulty: 'Hard', category: 'Amazon High-Frequency Priority', url: 'https://leetcode.com/problems/edit-distance/' },
  { id: '146', title: 'LRU Cache', difficulty: 'Medium', category: 'Amazon High-Frequency Priority', url: 'https://leetcode.com/problems/lru-cache/' },

  // ── Graph Priority List ──
  { id: '133', title: 'Clone Graph', difficulty: 'Medium', category: 'Graph Priority', url: 'https://leetcode.com/problems/clone-graph/' },
  { id: '207', title: 'Course Schedule', difficulty: 'Medium', category: 'Graph Priority', url: 'https://leetcode.com/problems/course-schedule/' },
  { id: '210', title: 'Course Schedule II', difficulty: 'Medium', category: 'Graph Priority', url: 'https://leetcode.com/problems/course-schedule-ii/' },
  { id: '785', title: 'Is Graph Bipartite?', difficulty: 'Medium', category: 'Graph Priority', url: 'https://leetcode.com/problems/is-graph-bipartite/' },
  { id: '547', title: 'Number of Provinces', difficulty: 'Medium', category: 'Graph Priority', url: 'https://leetcode.com/problems/number-of-provinces/' },
  { id: '417', title: 'Pacific Atlantic Water Flow', difficulty: 'Medium', category: 'Graph Priority', url: 'https://leetcode.com/problems/pacific-atlantic-water-flow/' },
  { id: '542', title: '01 Matrix', difficulty: 'Medium', category: 'Graph Priority', url: 'https://leetcode.com/problems/01-matrix/' },
  { id: '733', title: 'Flood Fill', difficulty: 'Easy', category: 'Graph Priority', url: 'https://leetcode.com/problems/flood-fill/' },
  { id: '1091', title: 'Shortest Path in Binary Matrix', difficulty: 'Medium', category: 'Graph Priority', url: 'https://leetcode.com/problems/shortest-path-in-binary-matrix/' },
  { id: '1971', title: 'Find if Path Exists in Graph', difficulty: 'Easy', category: 'Graph Priority', url: 'https://leetcode.com/problems/find-if-path-exists-in-graph/' },
  { id: '841', title: 'Keys and Rooms', difficulty: 'Medium', category: 'Graph Priority', url: 'https://leetcode.com/problems/keys-and-rooms/' },
  { id: '802', title: 'Find Eventual Safe States', difficulty: 'Medium', category: 'Graph Priority', url: 'https://leetcode.com/problems/find-eventual-safe-states/' },
  { id: '743', title: 'Network Delay Time', difficulty: 'Medium', category: 'Graph Priority', url: 'https://leetcode.com/problems/network-delay-time/' },
  { id: '1631', title: 'Path With Minimum Effort', difficulty: 'Medium', category: 'Graph Priority', url: 'https://leetcode.com/problems/path-with-minimum-effort/' },
  { id: '684', title: 'Redundant Connection', difficulty: 'Medium', category: 'Graph Priority', url: 'https://leetcode.com/problems/redundant-connection/' },
  { id: '721', title: 'Accounts Merge', difficulty: 'Medium', category: 'Graph Priority', url: 'https://leetcode.com/problems/accounts-merge/' },
  { id: '1584', title: 'Min Cost to Connect All Points', difficulty: 'Medium', category: 'Graph Priority', url: 'https://leetcode.com/problems/min-cost-to-connect-all-points/' },
  { id: '787', title: 'Cheapest Flights Within K Stops', difficulty: 'Medium', category: 'Graph Priority', url: 'https://leetcode.com/problems/cheapest-flights-within-k-stops/' },
  { id: '332', title: 'Reconstruct Itinerary', difficulty: 'Hard', category: 'Graph Priority', url: 'https://leetcode.com/problems/reconstruct-itinerary/' },
  { id: '399', title: 'Evaluate Division', difficulty: 'Medium', category: 'Graph Priority', url: 'https://leetcode.com/problems/evaluate-division/' },
  { id: '1274', title: 'Number of Ships in a Rectangle', difficulty: 'Hard', category: 'Graph Priority', url: 'https://leetcode.com/problems/number-of-ships-in-a-rectangle/' },

  // ── Tree Priority List ──
  { id: '104', title: 'Maximum Depth of Binary Tree', difficulty: 'Easy', category: 'Tree Priority', url: 'https://leetcode.com/problems/maximum-depth-of-binary-tree/' },
  { id: '102', title: 'Binary Tree Level Order Traversal', difficulty: 'Medium', category: 'Tree Priority', url: 'https://leetcode.com/problems/binary-tree-level-order-traversal/' },
  { id: '226', title: 'Invert Binary Tree', difficulty: 'Easy', category: 'Tree Priority', url: 'https://leetcode.com/problems/invert-binary-tree/' },
  { id: '100', title: 'Same Tree', difficulty: 'Easy', category: 'Tree Priority', url: 'https://leetcode.com/problems/same-tree/' },
  { id: '101', title: 'Symmetric Tree', difficulty: 'Easy', category: 'Tree Priority', url: 'https://leetcode.com/problems/symmetric-tree/' },
  { id: '105', title: 'Construct Binary Tree from Preorder and Inorder Traversal', difficulty: 'Medium', category: 'Tree Priority', url: 'https://leetcode.com/problems/construct-binary-tree-from-preorder-and-inorder-traversal/' },
  { id: '112', title: 'Path Sum', difficulty: 'Easy', category: 'Tree Priority', url: 'https://leetcode.com/problems/path-sum/' },
  { id: '113', title: 'Path Sum II', difficulty: 'Medium', category: 'Tree Priority', url: 'https://leetcode.com/problems/path-sum-ii/' },
  { id: '124', title: 'Binary Tree Maximum Path Sum', difficulty: 'Hard', category: 'Tree Priority', url: 'https://leetcode.com/problems/binary-tree-maximum-path-sum/' },
  { id: '199', title: 'Binary Tree Right Side View', difficulty: 'Medium', category: 'Tree Priority', url: 'https://leetcode.com/problems/binary-tree-right-side-view/' },
  { id: '230', title: 'Kth Smallest Element in a BST', difficulty: 'Medium', category: 'Tree Priority', url: 'https://leetcode.com/problems/kth-smallest-element-in-a-bst/' },
  { id: '235', title: 'Lowest Common Ancestor of a Binary Search Tree', difficulty: 'Medium', category: 'Tree Priority', url: 'https://leetcode.com/problems/lowest-common-ancestor-of-a-binary-search-tree/' },
  { id: '701', title: 'Insert into a Binary Search Tree', difficulty: 'Medium', category: 'Tree Priority', url: 'https://leetcode.com/problems/insert-into-a-binary-search-tree/' },
  { id: '450', title: 'Delete Node in a BST', difficulty: 'Medium', category: 'Tree Priority', url: 'https://leetcode.com/problems/delete-node-in-a-bst/' },
  { id: '173', title: 'Binary Search Tree Iterator', difficulty: 'Medium', category: 'Tree Priority', url: 'https://leetcode.com/problems/binary-search-tree-iterator/' },
  { id: '662', title: 'Maximum Width of Binary Tree', difficulty: 'Medium', category: 'Tree Priority', url: 'https://leetcode.com/problems/maximum-width-of-binary-tree/' },
  { id: '144', title: 'Binary Tree Preorder Traversal', difficulty: 'Easy', category: 'Tree Priority', url: 'https://leetcode.com/problems/binary-tree-preorder-traversal/' },
  { id: '94', title: 'Binary Tree Inorder Traversal', difficulty: 'Easy', category: 'Tree Priority', url: 'https://leetcode.com/problems/binary-tree-inorder-traversal/' },
  { id: '145', title: 'Binary Tree Postorder Traversal', difficulty: 'Easy', category: 'Tree Priority', url: 'https://leetcode.com/problems/binary-tree-postorder-traversal/' },
  { id: '106', title: 'Construct Binary Tree from Inorder and Postorder Traversal', difficulty: 'Medium', category: 'Tree Priority', url: 'https://leetcode.com/problems/construct-binary-tree-from-inorder-and-postorder-traversal/' },
  { id: '297', title: 'Serialize and Deserialize Binary Tree', difficulty: 'Hard', category: 'Tree Priority', url: 'https://leetcode.com/problems/serialize-and-deserialize-binary-tree/' },

  // ── Trie Priority List ──
  { id: '208', title: 'Implement Trie (Prefix Tree)', difficulty: 'Medium', category: 'Trie Priority', url: 'https://leetcode.com/problems/implement-trie-prefix-tree/' },
  { id: '211', title: 'Design Add and Search Words Data Structure', difficulty: 'Medium', category: 'Trie Priority', url: 'https://leetcode.com/problems/design-add-and-search-words-data-structure/' },
  { id: '212', title: 'Word Search II', difficulty: 'Hard', category: 'Trie Priority', url: 'https://leetcode.com/problems/word-search-ii/' },
  { id: '648', title: 'Replace Words', difficulty: 'Medium', category: 'Trie Priority', url: 'https://leetcode.com/problems/replace-words/' },
  { id: '677', title: 'Map Sum Pairs', difficulty: 'Medium', category: 'Trie Priority', url: 'https://leetcode.com/problems/map-sum-pairs/' },
  { id: '421', title: 'Maximum XOR of Two Numbers in an Array', difficulty: 'Medium', category: 'Trie Priority', url: 'https://leetcode.com/problems/maximum-xor-of-two-numbers-in-an-array/' },
  { id: '720', title: 'Longest Word in Dictionary', difficulty: 'Medium', category: 'Trie Priority', url: 'https://leetcode.com/problems/longest-word-in-dictionary/' },
  { id: '1268', title: 'Search Suggestions System', difficulty: 'Medium', category: 'Trie Priority', url: 'https://leetcode.com/problems/search-suggestions-system/' },
  { id: '676', title: 'Implement Magic Dictionary', difficulty: 'Medium', category: 'Trie Priority', url: 'https://leetcode.com/problems/implement-magic-dictionary/' },

  // ── High-Frequency Patterns ──
  { id: '904', title: 'Fruit Into Baskets', difficulty: 'Medium', category: 'High-Frequency Patterns', url: 'https://leetcode.com/problems/fruit-into-baskets/' },
  { id: '76', title: 'Minimum Window Substring', difficulty: 'Hard', category: 'High-Frequency Patterns', url: 'https://leetcode.com/problems/minimum-window-substring/' },
  { id: '503', title: 'Next Greater Element II', difficulty: 'Medium', category: 'High-Frequency Patterns', url: 'https://leetcode.com/problems/next-greater-element-ii/' },
  { id: '735', title: 'Asteroid Collision', difficulty: 'Medium', category: 'High-Frequency Patterns', url: 'https://leetcode.com/problems/asteroid-collision/' },
  { id: '32', title: 'Longest Valid Parentheses', difficulty: 'Hard', category: 'High-Frequency Patterns', url: 'https://leetcode.com/problems/longest-valid-parentheses/' },
  { id: '240', title: 'Search a 2D Matrix II', difficulty: 'Medium', category: 'High-Frequency Patterns', url: 'https://leetcode.com/problems/search-a-2d-matrix-ii/' },
  { id: '1011', title: 'Capacity To Ship Packages Within D Days', difficulty: 'Medium', category: 'High-Frequency Patterns', url: 'https://leetcode.com/problems/capacity-to-ship-packages-within-d-days/' },
  { id: '935', title: 'Knight Dialer', difficulty: 'Medium', category: 'High-Frequency Patterns', url: 'https://leetcode.com/problems/knight-dialer/' },
  { id: '1235', title: 'Maximum Profit in Job Scheduling', difficulty: 'Hard', category: 'High-Frequency Patterns', url: 'https://leetcode.com/problems/maximum-profit-in-job-scheduling/' },
  { id: '10', title: 'Regular Expression Matching', difficulty: 'Hard', category: 'High-Frequency Patterns', url: 'https://leetcode.com/problems/regular-expression-matching/' }
];

export const SHEETS_REGISTRY: SheetDefinition[] = [
  {
    id: 'blind75',
    title: 'Blind 75',
    badge: 'Standard 75',
    description: 'The core 75 LeetCode questions covering all fundamental interview patterns.',
    questions: BLIND75_QUESTIONS
  },
  {
    id: 'az_soumika',
    title: 'AZ SDE Prep (Soumika)',
    badge: 'Amazon Curated',
    description: 'High-frequency Amazon SDE intern & full-time interview preparation sheet compiled from Soumika notes.',
    questions: AZ_SOUMIKA_QUESTIONS
  }
];
