export function SearchBar(
  {
    searchQuery,
    setSearchQuery
  }: {
    searchQuery: string,
    setSearchQuery: Function
  }
) {
  return (
    <input
      type="text"
      placeholder="Search..."
      value={searchQuery}
      onChange={(e) => setSearchQuery(e.target.value)}
      style={{
        width: "40%",
        padding: "10px",
        fontSize: "16px",
        borderRadius: "4px",
        border: "1px solid #ccc",
        boxSizing: "border-box"
      }}
    />
  );
}

export function cleanQuery(query: string) {
  return query.toLowerCase().replace(/[^a-z0-9 ]/g, "");
}