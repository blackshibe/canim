#!/usr/bin/env lua

-- lazy tooling to build a standalone version of the Canim library that works without the roblox-ts runtime

local index = io.open("../out/init.lua", "r+")
local replaced = 0

function mysplit(inputstr, sep)
	if sep == nil then
		sep = "%s"
	end
	local t = {}
	for str in string.gmatch(inputstr, "([^" .. sep .. "]+)") do
		table.insert(t, str)
	end
	return t
end

local content = index:read("*all")
local toreplace = {
	{ "local TS = _G[script]", "" },
	{
		'local Signal = TS.import(script, script, "dependencies", "Signal")',
		'local Signal = require(script:WaitForChild("dependencies"):WaitForChild("Signal"))',
	},
	{
		'local Maid = TS.import(script, script, "dependencies", "Maid")',
		'local Maid = require(script:WaitForChild("dependencies"):WaitForChild("Maid"))',
	},
	{
		'local easing = TS.import(script, script, "easing", "easing")',
		'local easing = require(script:WaitForChild("easing"):WaitForChild("easing"))',
	},
}

local result = ""
for i, line in pairs(mysplit(content, "\n")) do
	for i, v in pairs(toreplace) do
		if line == v[1] then
			line = v[2]
		end
	end

	result = result .. line .. "\n"
end

index:write(result)
index:close()

-- lua is annoying
io.open("../out/init.lua", "w"):write(result):close()
