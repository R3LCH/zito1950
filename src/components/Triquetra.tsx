export function Triquetra({ className = '' }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M17.00 11.33A10.00 10.00 0 0 1 2.00 19.99A10.00 10.00 0 0 1 17.00 11.33" />
      <path d="M12.00 19.99A10.00 10.00 0 0 1 12.00 2.67A10.00 10.00 0 0 1 12.00 19.99" />
      <path d="M7.00 11.33A10.00 10.00 0 0 1 22.00 19.99A10.00 10.00 0 0 1 7.00 11.33" />
    </svg>
  )
}
