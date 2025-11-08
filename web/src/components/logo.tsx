import Image from "next/image"

export function Logo({
  className = "",
  width = 24,
  height = 24,
}: {
  className?: string
  width?: number
  height?: number
}) {
  return (
    <Image
      src="/coupang.png"
      width={width}
      height={height}
      className={className}
      alt="Shadcnblocks"
    />
  )
}
