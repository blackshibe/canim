rm ../out -rf

# build .tgz
cd ../
rbxtsc --verbose
npm pack

# build .rbxm
cd util
./build_lua_lib.lua
cd ../
rojo build -o rbxts-canim.rbxm