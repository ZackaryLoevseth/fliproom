// Explicit fields keep internal document metadata out of the public application.
// Placements resolve equipment references rather than copying equipment data.
export const CATALOG_QUERY = `
*[_type == "room" && appKey == $roomKey][0]{
  "room": {"id": appKey, name, width, height},
  "items": *[_type == "equipment" && room._ref == ^._id]
    | order(sortOrder asc, _id asc){
      "id": appKey, label, kind, width, height, minutes
    },
  "scenes": *[_type == "layout" && room._ref == ^._id]
    | order(sortOrder asc, _id asc){
      "id": appKey, name, "subtitle": coalesce(subtitle, ""), color,
      "placements": placements[]{
        "itemId": equipment->appKey, x, y, rotation
      }
    }
}`;
