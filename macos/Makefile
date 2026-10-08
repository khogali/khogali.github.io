# Builds Mudroom.app from the Swift package without an Xcode project.
#   make            -> build/Mudroom.app (ad-hoc signed, runs on your own Mac)
#   make run        -> build and launch
#   make install-host EXT_ID=<chrome extension id>  -> register the native-messaging host for Chrome
#   make clean

APP      := build/Mudroom.app
BIN      := .build/release/Mudroom
HOST     := .build/release/mudroom-host
IDENT    ?= -
EXT_ID   ?= CHANGE_ME
HOST_DIR := $(HOME)/Library/Application\ Support/Google/Chrome/NativeMessagingHosts

.PHONY: all build app run clean install-host uninstall-host

all: app

build:
	swift build -c release

app: build
	rm -rf $(APP)
	mkdir -p $(APP)/Contents/MacOS $(APP)/Contents/Resources
	cp Info.plist $(APP)/Contents/
	cp $(BIN) $(APP)/Contents/MacOS/Mudroom
	cp $(HOST) $(APP)/Contents/MacOS/mudroom-host
	@if [ -f Mudroom.icns ]; then cp Mudroom.icns $(APP)/Contents/Resources/; fi
	codesign --force --sign "$(IDENT)" --options runtime --entitlements entitlements.plist $(APP) 2>/dev/null || codesign --force --sign "$(IDENT)" $(APP)
	@echo "built $(APP)"

run: app
	open $(APP)

install-host: app
	mkdir -p $(HOST_DIR)
	sed -e "s|__HOST_PATH__|$(abspath $(APP))/Contents/MacOS/mudroom-host|" -e "s|__EXT_ID__|$(EXT_ID)|" com.khogali.mudroom.json.in > $(HOST_DIR)/com.khogali.mudroom.json
	@echo "installed native messaging host for extension $(EXT_ID)"

uninstall-host:
	rm -f $(HOST_DIR)/com.khogali.mudroom.json

clean:
	rm -rf .build build
