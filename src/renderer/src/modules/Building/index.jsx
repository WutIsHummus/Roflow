function ComingSoon({ title, description, icon }) {
  return (
    <div className="h-full flex items-center justify-center">
      <div className="text-center max-w-sm space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-[#1a1a1a] border border-[#2a2a2a] flex items-center justify-center mx-auto text-2xl">
          {icon}
        </div>
        <div>
          <h2 className="text-lg font-semibold text-[#f0f0f0]">{title}</h2>
          <p className="text-sm text-[#555555] mt-1.5">{description}</p>
        </div>
        <span className="inline-block px-3 py-1 rounded-full bg-[#1a1a1a] border border-[#2a2a2a] text-xs text-[#555555]">
          Coming Soon
        </span>
      </div>
    </div>
  )
}

export default function BuildingModule() {
  return (
    <ComingSoon
      title="Building Generator"
      description="Auto-generate Roblox buildings and assets from text prompts using Tripo3D and other AI tools."
      icon="🏗️"
    />
  )
}
