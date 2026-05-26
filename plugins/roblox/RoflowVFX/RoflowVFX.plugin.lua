--[[
  RoFlow VFX Studio — Roblox Studio Plugin
  Imports RoFlow export bundles, uploads textures to Roblox, and builds VFX in Workspace.

  Install: RoFlow → VFX Studio → Install Studio Plugin
  Or copy this folder to %LOCALAPPDATA%\Roblox\Plugins\RoflowVFX\
]]

local PLUGIN_NAME = "RoFlow VFX"
local PLUGIN_VERSION = "1.0.0"

local AssetService = game:GetService("AssetService")
local ChangeHistoryService = game:GetService("ChangeHistoryService")
local HttpService = game:GetService("HttpService")
local Selection = game:GetService("Selection")
local StudioService = game:GetService("StudioService")

local plugin = plugin
local toolbar = plugin:CreateToolbar(PLUGIN_NAME)
local importButton = toolbar:CreateButton(
	"Import RoFlow VFX",
	"Import a RoFlow VFX bundle (manifest.json + textures)",
	"rbxassetid://6031068427"
)

local widgetInfo = DockWidgetPluginGuiInfo.new(
	Enum.InitialDockState.Float,
	false,
	false,
	360,
	420,
	320,
	280
)

local widget = plugin:CreateDockWidgetPluginGui("RoFlowVFXWidget", widgetInfo)
widget.Title = PLUGIN_NAME .. " v" .. PLUGIN_VERSION

local root = Instance.new("Frame")
root.BackgroundColor3 = Color3.fromRGB(24, 28, 36)
root.BorderSizePixel = 0
root.Size = UDim2.fromScale(1, 1)
root.Parent = widget

local padding = Instance.new("UIPadding")
padding.PaddingTop = UDim.new(0, 12)
padding.PaddingBottom = UDim.new(0, 12)
padding.PaddingLeft = UDim.new(0, 12)
padding.PaddingRight = UDim.new(0, 12)
padding.Parent = root

local layout = Instance.new("UIListLayout")
layout.SortOrder = Enum.SortOrder.LayoutOrder
layout.Padding = UDim.new(0, 8)
layout.Parent = root

local function makeLabel(text, order, size)
	local label = Instance.new("TextLabel")
	label.BackgroundTransparency = 1
	label.Font = Enum.Font.Gotham
	label.TextColor3 = Color3.fromRGB(220, 226, 236)
	label.TextSize = size or 14
	label.TextXAlignment = Enum.TextXAlignment.Left
	label.TextWrapped = true
	label.Size = UDim2.new(1, 0, 0, 0)
	label.AutomaticSize = Enum.AutomaticSize.Y
	label.Text = text
	label.LayoutOrder = order
	label.Parent = root
	return label
end

local function makeButton(text, order, callback)
	local button = Instance.new("TextButton")
	button.AutoButtonColor = true
	button.BackgroundColor3 = Color3.fromRGB(88, 28, 135)
	button.BorderSizePixel = 0
	button.Font = Enum.Font.GothamBold
	button.TextColor3 = Color3.fromRGB(255, 255, 255)
	button.TextSize = 13
	button.Size = UDim2.new(1, 0, 0, 34)
	button.Text = text
	button.LayoutOrder = order
	button.Parent = root

	local corner = Instance.new("UICorner")
	corner.CornerRadius = UDim.new(0, 8)
	corner.Parent = button

	button.MouseButton1Click:Connect(callback)
	return button
end

local statusLabel = makeLabel("Export a bundle from RoFlow, then import it here.", 1, 13)
statusLabel.TextColor3 = Color3.fromRGB(140, 150, 170)

local uploadToggle = Instance.new("TextButton")
uploadToggle.AutoButtonColor = false
uploadToggle.BackgroundColor3 = Color3.fromRGB(34, 40, 52)
uploadToggle.BorderSizePixel = 0
uploadToggle.Font = Enum.Font.Gotham
uploadToggle.TextColor3 = Color3.fromRGB(210, 220, 235)
uploadToggle.TextSize = 12
uploadToggle.Size = UDim2.new(1, 0, 0, 30)
uploadToggle.Text = "Upload textures to Roblox: ON"
uploadToggle.LayoutOrder = 2
uploadToggle.Parent = root

local uploadCorner = Instance.new("UICorner")
uploadCorner.CornerRadius = UDim.new(0, 8)
uploadCorner.Parent = uploadToggle

local uploadToRoblox = true
uploadToggle.MouseButton1Click:Connect(function()
	uploadToRoblox = not uploadToRoblox
	uploadToggle.Text = uploadToRoblox and "Upload textures to Roblox: ON" or "Upload textures to Roblox: OFF (session temp IDs)"
end)

local function setStatus(text, isError)
	statusLabel.Text = text
	statusLabel.TextColor3 = isError and Color3.fromRGB(248, 113, 113) or Color3.fromRGB(140, 150, 170)
end

local function sanitizeName(value)
	return string.gsub(tostring(value or "Layer"), "[^%w%s%-_]", "")
end

local function hexToColor3(hex)
	local raw = string.gsub(tostring(hex or "#ffffff"), "#", "")
	if #raw ~= 6 then
		return Color3.fromRGB(255, 255, 255)
	end
	local r = tonumber(string.sub(raw, 1, 2), 16) or 255
	local g = tonumber(string.sub(raw, 3, 4), 16) or 255
	local b = tonumber(string.sub(raw, 5, 6), 16) or 255
	return Color3.fromRGB(r, g, b)
end

local function buildColorSequence(sequenceData, fallbackColor)
	local keypoints = sequenceData and sequenceData.keypoints
	if type(keypoints) ~= "table" or #keypoints < 2 then
		local color = hexToColor3(fallbackColor)
		return ColorSequence.new(color)
	end

	table.sort(keypoints, function(a, b)
		return (a.time or 0) < (b.time or 0)
	end)

	local entries = {}
	for _, kp in ipairs(keypoints) do
		table.insert(entries, ColorSequenceKeypoint.new(kp.time or 0, hexToColor3(kp.color or fallbackColor)))
	end
	return ColorSequence.new(entries)
end

local function buildNumberSequence(sequenceData, fallbackStart, fallbackEnd)
	local keypoints = sequenceData and sequenceData.keypoints
	if type(keypoints) ~= "table" or #keypoints < 2 then
		return NumberSequence.new({
			NumberSequenceKeypoint.new(0, fallbackStart or 0),
			NumberSequenceKeypoint.new(1, fallbackEnd or 1),
		})
	end

	table.sort(keypoints, function(a, b)
		return (a.time or 0) < (b.time or 0)
	end)

	local entries = {}
	for _, kp in ipairs(keypoints) do
		table.insert(entries, NumberSequenceKeypoint.new(kp.time or 0, kp.value or 0))
	end
	return NumberSequence.new(entries)
end

local EMISSION_DIRECTION = {
	Top = Enum.NormalId.Top,
	Bottom = Enum.NormalId.Bottom,
	Front = Enum.NormalId.Front,
	Back = Enum.NormalId.Back,
	Left = Enum.NormalId.Left,
	Right = Enum.NormalId.Right,
}

local EMISSION_SHAPE = {
	Ball = Enum.ParticleEmitterShape.Ball,
	Box = Enum.ParticleEmitterShape.Box,
	Cylinder = Enum.ParticleEmitterShape.Cylinder,
	Disc = Enum.ParticleEmitterShape.Disc,
	Sphere = Enum.ParticleEmitterShape.Sphere,
}

local SHAPE_IN_OUT = {
	Inward = Enum.ParticleEmitterShapeInOut.Inward,
	Outward = Enum.ParticleEmitterShapeInOut.Outward,
	InAndOut = Enum.ParticleEmitterShapeInOut.InAndOut,
}

local SHAPE_STYLE = {
	Volume = Enum.ParticleEmitterShapeStyle.Volume,
	Surface = Enum.ParticleEmitterShapeStyle.Surface,
}

local ORIENTATION = {
	FacingCamera = Enum.ParticleOrientation.FacingCamera,
	FacingCameraWorldUp = Enum.ParticleOrientation.FacingCameraWorldUp,
	VelocityParallel = Enum.ParticleOrientation.VelocityParallel,
	VelocityPerpendicular = Enum.ParticleOrientation.VelocityPerpendicular,
}

local FLIPBOOK_LAYOUT = {
	None = Enum.ParticleFlipbookLayout.None,
	Grid2x2 = Enum.ParticleFlipbookLayout.Grid2x2,
	Grid4x4 = Enum.ParticleFlipbookLayout.Grid4x4,
	Grid8x8 = Enum.ParticleFlipbookLayout.Grid8x8,
}

local FLIPBOOK_MODE = {
	None = Enum.ParticleFlipbookMode.None,
	Loop = Enum.ParticleFlipbookMode.Loop,
	PingPong = Enum.ParticleFlipbookMode.PingPong,
	Random = Enum.ParticleFlipbookMode.Random,
	OneShot = Enum.ParticleFlipbookMode.OneShot,
}

local function createProceduralShapeImage(shapeName, tintColor)
	local size = Vector2.new(256, 256)
	local image = AssetService:CreateEditableImage({ Size = size })
	local center = size / 2
	local color = tintColor or Color3.fromRGB(167, 139, 250)

	local ok = pcall(function()
		if shapeName == "ring" then
			image:DrawCircle(center, 96, color, 1)
			image:DrawCircle(center, 58, Color3.new(0, 0, 0), 0)
		elseif shapeName == "spark" or shapeName == "slash" then
			image:DrawRectangle(Vector2.new(18, 118), Vector2.new(238, 138), color, 1)
		elseif shapeName == "smoke" then
			image:DrawCircle(center, 92, Color3.new(color.R, color.G, color.B), 0.55)
			image:DrawCircle(center + Vector2.new(-24, 10), 48, Color3.new(color.R, color.G, color.B), 0.35)
			image:DrawCircle(center + Vector2.new(28, -8), 42, Color3.new(color.R, color.G, color.B), 0.3)
		elseif shapeName == "flare" then
			image:DrawCircle(center, 110, color, 1)
			image:DrawRectangle(Vector2.new(122, 18), Vector2.new(134, 238), color, 0.85)
			image:DrawRectangle(Vector2.new(18, 122), Vector2.new(238, 134), color, 0.85)
		else
			image:DrawCircle(center, 104, color, 1)
			image:DrawCircle(center, 52, Color3.new(1, 1, 1), 0.65)
		end
	end)

	if not ok then
		pcall(function()
			image:DrawCircle(center, 100, color, 1)
		end)
	end

	return image
end

local function uploadEditableImage(editableImage, assetName)
	if not uploadToRoblox then
		return nil, editableImage
	end

	local ok, result, assetIdOrErr = pcall(function()
		return AssetService:CreateAssetAsync(editableImage, Enum.AssetType.Image, {
			Name = sanitizeName(assetName),
			Description = "RoFlow VFX Studio texture",
		})
	end)

	if not ok then
		error("CreateAssetAsync failed: " .. tostring(result))
	end

	if result ~= Enum.CreateAssetResult.Success then
		error("Texture upload failed: " .. tostring(result) .. " — " .. tostring(assetIdOrErr))
	end

	return assetIdOrErr, editableImage
end

local function uploadFileTexture(file, assetName)
	local tempId = file:GetTemporaryId()
	local editableImage = AssetService:CreateEditableImageAsync(Content.fromUri(tempId))
	return uploadEditableImage(editableImage, assetName)
end

local function uploadProceduralTexture(shapeName, tintHex, assetName)
	local editableImage = createProceduralShapeImage(shapeName, hexToColor3(tintHex))
	return uploadEditableImage(editableImage, assetName)
end

local function textureContentFromAssetId(assetId, editableImage)
	if assetId then
		return "rbxassetid://" .. tostring(assetId)
	end
	if editableImage then
		return Content.fromObject(editableImage)
	end
	return ""
end

local function applyTexture(instance, assetId, editableImage)
	local content = textureContentFromAssetId(assetId, editableImage)
	if content == "" then
		return
	end

	local ok = pcall(function()
		instance.Texture = content
	end)
	if not ok then
		pcall(function()
			instance.TextureContent = content
		end)
	end
end

local function resolveParentPart()
	local selected = Selection:Get()
	for _, item in ipairs(selected) do
		if item:IsA("BasePart") then
			return item
		end
		if item:IsA("Attachment") and item.Parent and item.Parent:IsA("BasePart") then
			return item.Parent
		end
	end

	local holder = Instance.new("Part")
	holder.Name = "RoFlowVFXHolder"
	holder.Anchored = true
	holder.CanCollide = false
	holder.Transparency = 1
	holder.Size = Vector3.new(1, 1, 1)
	holder.CFrame = CFrame.new(0, 3, 0)
	holder.Parent = workspace
	return holder
end

local function buildBeamLayer(folder, holder, layer, assetId, editableImage)
	local startAttachment = Instance.new("Attachment")
	startAttachment.Name = sanitizeName(layer.name) .. "Start"
	startAttachment.Position = Vector3.new(-1.2, 0, 0)
	startAttachment.Parent = holder

	local endAttachment = Instance.new("Attachment")
	endAttachment.Name = sanitizeName(layer.name) .. "End"
	endAttachment.Position = Vector3.new(1.2, 0, 0)
	endAttachment.Parent = holder

	local beam = Instance.new("Beam")
	beam.Name = sanitizeName(layer.name)
	beam.Attachment0 = startAttachment
	beam.Attachment1 = endAttachment
	beam.FaceCamera = true
	beam.Width0 = layer.width0 or 0.5
	beam.Width1 = layer.width1 or 0.5
	beam.LightEmission = layer.lightEmission or 1
	beam.LightInfluence = layer.lightInfluence or 0
	beam.Color = buildColorSequence(layer.color, fallbackHex(layer))
	beam.Transparency = buildNumberSequence(layer.transparency, 1 - (layer.opacity or 0.8), layer.transparencyEnd or 1)
	applyTexture(beam, assetId, editableImage)
	beam.Parent = folder
	return beam
end

local function buildTrailLayer(folder, holder, layer, assetId, editableImage)
	local startAttachment = Instance.new("Attachment")
	startAttachment.Name = sanitizeName(layer.name) .. "Start"
	startAttachment.Position = Vector3.new(-0.65, 0.4, 0)
	startAttachment.Parent = holder

	local endAttachment = Instance.new("Attachment")
	endAttachment.Name = sanitizeName(layer.name) .. "End"
	endAttachment.Position = Vector3.new(0.65, -0.4, 0)
	endAttachment.Parent = holder

	local trail = Instance.new("Trail")
	trail.Name = sanitizeName(layer.name)
	trail.Attachment0 = startAttachment
	trail.Attachment1 = endAttachment
	trail.FaceCamera = true
	trail.MinLength = 0.05
	trail.Lifetime = (layer.lifetime and layer.lifetime.max) or layer.lifetimeMax or 0.5
	trail.LightEmission = layer.lightEmission or 1
	trail.LightInfluence = layer.lightInfluence or 0
	trail.Color = buildColorSequence(layer.color, fallbackHex(layer))
	trail.Transparency = buildNumberSequence(layer.transparency, 1 - (layer.opacity or 0.8), layer.transparencyEnd or 1)
	trail.WidthScale = buildNumberSequence(layer.size, layer.sizeMin or 0.3, layer.sizeMax or 1)
	applyTexture(trail, assetId, editableImage)
	trail.Parent = folder
	return trail
end

local function buildParticleLayer(folder, anchor, layer, assetId, editableImage)
	local emitter = Instance.new("ParticleEmitter")
	emitter.Name = sanitizeName(layer.name)
	emitter.Enabled = layer.enabled ~= false
	emitter.Rate = layer.rate or 20
	emitter.Lifetime = NumberRange.new(
		(layer.lifetime and layer.lifetime.min) or layer.lifetimeMin or 0.1,
		(layer.lifetime and layer.lifetime.max) or layer.lifetimeMax or 0.5
	)
	emitter.Speed = NumberRange.new(
		(layer.speed and layer.speed.min) or layer.speedMin or 4,
		(layer.speed and layer.speed.max) or layer.speedMax or 12
	)
	emitter.SpreadAngle = Vector2.new(layer.spread or 18, layer.spreadAngleY or layer.spread or 18)
	emitter.Drag = layer.drag or 0.1
	emitter.LightEmission = layer.lightEmission or 1
	emitter.LightInfluence = layer.lightInfluence or 0
	emitter.ZOffset = layer.zOffset or 0
	emitter.VelocityInheritance = layer.velocityInheritance or 0
	emitter.WindAffectsDrag = layer.windAffectsDrag == true
	emitter.LockedToPart = layer.lockedToPart == true
	emitter.TimeScale = layer.timeScale or 1
	emitter.FlipbookStartRandom = layer.flipbookStartRandom == true

	local accel = layer.acceleration or {}
	emitter.Acceleration = Vector3.new(accel.x or layer.accelerationX or 0, accel.y or layer.accelerationY or 0, accel.z or layer.accelerationZ or 0)
	emitter.Rotation = NumberRange.new(
		(layer.rotation and layer.rotation.min) or layer.rotationMin or 0,
		(layer.rotation and layer.rotation.max) or layer.rotationMax or 0
	)
	emitter.RotSpeed = NumberRange.new(
		(layer.rotSpeed and layer.rotSpeed.min) or layer.rotSpeedMin or 0,
		(layer.rotSpeed and layer.rotSpeed.max) or layer.rotSpeedMax or 0
	)
	emitter.FlipbookFramerate = NumberRange.new(
		(layer.flipbookFramerate and layer.flipbookFramerate.min) or layer.flipbookFramerateMin or 1,
		(layer.flipbookFramerate and layer.flipbookFramerate.max) or layer.flipbookFramerateMax or 1
	)

	emitter.EmissionDirection = EMISSION_DIRECTION[layer.emissionDirection or "Top"] or Enum.NormalId.Top
	emitter.Shape = EMISSION_SHAPE[layer.emissionShape or "Sphere"] or Enum.ParticleEmitterShape.Sphere
	emitter.ShapeInOut = SHAPE_IN_OUT[layer.shapeInOut or "Outward"] or Enum.ParticleEmitterShapeInOut.Outward
	emitter.ShapeStyle = SHAPE_STYLE[layer.shapeStyle or "Volume"] or Enum.ParticleEmitterShapeStyle.Volume
	emitter.Orientation = ORIENTATION[layer.orientation or "FacingCamera"] or Enum.ParticleOrientation.FacingCamera
	emitter.FlipbookLayout = FLIPBOOK_LAYOUT[layer.flipbookLayout or "None"] or Enum.ParticleFlipbookLayout.None
	emitter.FlipbookMode = FLIPBOOK_MODE[layer.flipbookMode or "None"] or Enum.ParticleFlipbookMode.None

	emitter.Color = buildColorSequence(layer.color, fallbackHex(layer))
	emitter.Size = buildNumberSequence(layer.size, layer.sizeMin or 0.3, layer.sizeMax or 1)
	emitter.Transparency = buildNumberSequence(layer.transparency, 1 - (layer.opacity or 0.8), layer.transparencyEnd or 1)
	applyTexture(emitter, assetId, editableImage)
	emitter.Parent = anchor
	return emitter
end

local function buildEffectInWorkspace(preset, textureMap)
	local effectName = sanitizeName(preset.meta and preset.meta.effectName or "RoFlowVFX")
	local holder = resolveParentPart()
	local folder = Instance.new("Folder")
	folder.Name = effectName .. "VFX"
	folder.Parent = workspace

	local anchor = Instance.new("Attachment")
	anchor.Name = effectName .. "Anchor"
	anchor.Parent = holder

	local created = {}

	for _, layer in ipairs(preset.layers or {}) do
		if layer.enabled == false then
			continue
		end

		local textureEntry = textureMap[layer.id]
		local assetId = textureEntry and textureEntry.assetId or nil
		local editableImage = textureEntry and textureEntry.editableImage or nil
		local className = layer.robloxClass or "ParticleEmitter"

		local instance
		if className == "Beam" then
			instance = buildBeamLayer(folder, holder, layer, assetId, editableImage)
		elseif className == "Trail" then
			instance = buildTrailLayer(folder, holder, layer, assetId, editableImage)
		else
			instance = buildParticleLayer(folder, anchor, layer, assetId, editableImage)
		end

		table.insert(created, instance)
	end

	Selection:Set({ folder, holder })
	return folder, created
end

local function indexFilesByName(files)
	local map = {}
	for _, file in ipairs(files) do
		map[string.lower(file.Name)] = file
	end
	return map
end

local function decodeManifestFile(file)
	local raw = file:GetBinaryContents()
	return HttpService:JSONDecode(raw)
end

local function decodePresetFile(file)
	local raw = file:GetBinaryContents()
	return HttpService:JSONDecode(raw)
end

local function fallbackHex(layer)
	if layer.color and layer.color.keypoints and layer.color.keypoints[1] and layer.color.keypoints[1].color then
		return layer.color.keypoints[1].color
	end
	return "#a78bfa"
end

local function importBundle()
	setStatus("Select manifest.json, preset.json, and texture files from your export folder…")

	local pickedFiles = StudioService:PromptImportFiles({ "json", "png", "jpg", "jpeg", "webp" })
	if not pickedFiles or #pickedFiles == 0 then
		setStatus("Import cancelled.")
		return
	end

	local manifestFile = nil
	local presetFile = nil
	local fileMap = indexFilesByName(pickedFiles)

	for _, file in ipairs(pickedFiles) do
		local lowerName = string.lower(file.Name)
		if lowerName == "manifest.json" then
			manifestFile = file
		end
	end

	if not manifestFile then
		setStatus("manifest.json was not selected. Pick it along with your textures.", true)
		return
	end

	local manifest
	local ok, err = pcall(function()
		manifest = decodeManifestFile(manifestFile)
	end)
	if not ok or type(manifest) ~= "table" then
		setStatus("Could not parse manifest.json: " .. tostring(err), true)
		return
	end

	local presetName = string.lower(manifest.presetFile or "")
	for _, file in ipairs(pickedFiles) do
		if string.lower(file.Name) == presetName then
			presetFile = file
			break
		end
	end

	if not presetFile then
		setStatus("Select the preset JSON listed in manifest (" .. tostring(manifest.presetFile) .. ")…")
		local presetPick = StudioService:PromptImportFiles({ "json" })
		if not presetPick or #presetPick == 0 then
			setStatus("Preset selection cancelled.", true)
			return
		end
		presetFile = presetPick[1]
	end

	local preset
	ok, err = pcall(function()
		preset = decodePresetFile(presetFile)
	end)
	if not ok or type(preset) ~= "table" then
		setStatus("Could not parse preset JSON: " .. tostring(err), true)
		return
	end

	local needsFileTextures = {}
	for _, textureEntry in ipairs(manifest.textures or {}) do
		if textureEntry.kind == "file" and textureEntry.fileName then
			table.insert(needsFileTextures, textureEntry)
		end
	end

	if #needsFileTextures > 0 then
		local missing = {}
		for _, textureEntry in ipairs(needsFileTextures) do
			local baseName = string.lower((textureEntry.fileName or ""):match("([^/\\]+)$") or "")
			if not fileMap[baseName] then
				table.insert(missing, baseName)
			end
		end

		if #missing > 0 then
			setStatus("Select missing texture files: " .. table.concat(missing, ", "))
			local textureFiles = StudioService:PromptImportFiles({ "png", "jpg", "jpeg", "webp" })
			if not textureFiles or #textureFiles == 0 then
				setStatus("Texture selection cancelled.", true)
				return
			end
			for name, file in pairs(indexFilesByName(textureFiles)) do
				fileMap[name] = file
			end
		end
	end

	ChangeHistoryService:SetWaypoint("Before RoFlow VFX Import")

	local textureMap = {}
	local uploadedCount = 0

	for _, textureEntry in ipairs(manifest.textures or {}) do
		local layerId = textureEntry.layerId
		if textureEntry.kind == "file" then
			local baseName = string.lower((textureEntry.fileName or ""):match("([^/\\]+)$") or "")
			local file = fileMap[baseName]
			if not file then
				warn("[RoFlow VFX] Missing texture file for layer " .. tostring(layerId) .. ": " .. tostring(textureEntry.fileName))
				continue
			end

			local assetId, editableImage = uploadFileTexture(file, textureEntry.uploadName or layerId)
			textureMap[layerId] = { assetId = assetId, editableImage = editableImage }
			if assetId then
				uploadedCount += 1
			end
		elseif textureEntry.kind == "procedural" then
			local assetId, editableImage = uploadProceduralTexture(
				textureEntry.proceduralShape or "orb",
				textureEntry.color or "#a78bfa",
				textureEntry.uploadName or layerId
			)
			textureMap[layerId] = { assetId = assetId, editableImage = editableImage }
			if assetId then
				uploadedCount += 1
			end
		end
	end

	local folder, created = buildEffectInWorkspace(preset, textureMap)
	ChangeHistoryService:SetWaypoint("After RoFlow VFX Import")

	local uploadLabel = uploadToRoblox and (tostring(uploadedCount) .. " uploaded") or "temp session textures"
	setStatus(
		string.format(
			"Imported %s with %d layer(s). Textures: %s. Selected in Explorer.",
			folder.Name,
			#created,
			uploadLabel
		)
	)
end

makeButton("Import RoFlow Bundle", 3, importBundle)
makeLabel(
	"Tip: select a Part before importing to parent the effect on it. Otherwise a transparent holder part is created at the world origin.",
	4,
	12
)

importButton.Click:Connect(function()
	widget.Enabled = not widget.Enabled
end)

plugin.Unloading:Connect(function()
	widget:Destroy()
end)
