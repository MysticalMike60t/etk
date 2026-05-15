PKG_MGR=pnpm
PKG_MGR_EXEC_CMD=exec
BUILD_SCRIPT_PATH=scripts/build.mjs
RELEASE_FOLDER=dist

build: format-code typecheck
	node $(BUILD_SCRIPT_PATH)

build-chrome: format-code typecheck
	node $(BUILD_SCRIPT_PATH) chrome

build-firefox: format-code typecheck
	node $(BUILD_SCRIPT_PATH) firefox

clean:
	rm -rf $(RELEASE_FOLDER)

format-code:
	$(PKG_MGR) $(PKG_MGR_EXEC_CMD) prettier . --write --config=".prettierrc"

typecheck:
	$(PKG_MGR) $(PKG_MGR_EXEC_CMD) tsc --noEmit
