export type Album = {
  $id: string
  title: string
  slug: string
  description: string
  thumbnail: string
  is_premium: 'yes' | 'no' | boolean | number
  view_count?: number
  created_at: string
  item_count?: number
  video_count?: number
  image_count?: number
  cover?: string
}
export type AlbumItem = {
  $id: string
  album_id: string
  type: 'video' | 'image'
  title: string
  r2_url: string
  thumbnail: string
  sort_order: number
}
