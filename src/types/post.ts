export type PostStatus = 'public' | 'private'
export type PremiumStatus = 'yes' | 'no'
export type Post = { $id: string; title: string; slug: string; description: string; image_url: string; category: string; is_premium: PremiumStatus; status: PostStatus; views: number; link_clicks: number; created_at: string }
