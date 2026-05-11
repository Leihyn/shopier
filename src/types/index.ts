export interface User {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  bio: string;
  fitsCount: number;
  followersCount: number;
  followingCount: number;
  isVerified: boolean;
  createdAt: string;
}

export interface FitItem {
  id: string;
  name: string;
  brand: string;
  price: number;
  affiliateUrl: string;
  category: "top" | "bottom" | "shoes" | "accessory" | "outerwear" | "other";
}

export interface Fit {
  id: string;
  user: User;
  mediaUrl: string;
  mediaType: "image" | "video";
  caption: string;
  isMirrorPic: boolean;
  items: FitItem[];
  likesCount: number;
  savesCount: number;
  isLiked: boolean;
  isSaved: boolean;
  createdAt: string;
}

// Agent types

export interface AgentMessage {
  id: string;
  role: "user" | "agent";
  content: string;
  imageUrl?: string;
  breakdown?: OutfitBreakdown;
  transactions?: AgentTransaction[];
  timestamp: string;
}

export interface OutfitBreakdown {
  items: DecomposedItem[];
  totalExact: number;
  totalMid: number;
  totalBudget: number;
  styleNotes: string;
}

export interface DecomposedItem {
  name: string;
  category: FitItem["category"];
  color: string;
  style: string;
  alternatives: ProductMatch[];
}

export interface ProductMatch {
  name: string;
  brand: string;
  price: number;
  tier: "exact" | "mid" | "budget" | "thrifted";
  url: string;
  imageUrl?: string;
  color?: string;
  retailer: string;
}

export interface AgentTransaction {
  id: string;
  type: "x402_api" | "purchase";
  description: string;
  amount: string;
  asset: string;
  stellarTxHash?: string;
  timestamp: string;
}

export interface AgentWallet {
  publicKey: string;
  balanceXLM: string;
  balanceUSDC: string;
  transactions: AgentTransaction[];
  spendingPolicy: SpendingPolicy;
}

export interface SpendingPolicy {
  maxPerTransaction: number;
  maxDailySpend: number;
  autoApproveUnder: number;
  dailySpent: number;
  secondhandFirst: boolean;
}
