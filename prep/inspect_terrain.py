import rasterio
with rasterio.open("data/terrain_woodjam.tif") as src:
    arr = src.read(1)
    print(f"min: {arr.min()}, max: {arr.max()}, mean: {arr.mean():.1f}")
    print(f"shape: {arr.shape}")
    print(f"nodata flag: {src.nodata}")
    print(f"nodata count: {(arr == src.nodata).sum() if src.nodata is not None else 'no nodata flag'}")
    print(f"flat zero count: {(arr == 0).sum()}")
    vals = sorted(set(arr.flatten().tolist()))
    print(f"lowest 20 unique values: {vals[:20]}")
