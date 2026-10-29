.PHONY: clean All

All:
	@echo "==========Building project:[ KhyleProject - Debug ]=========="
	@cd "KhyleProject" && "$(MAKE)" -f  "KhyleProject.mk"
clean:
	@echo "==========Cleaning project:[ KhyleProject - Debug ]----------"
	@cd "KhyleProject" && "$(MAKE)" -f  "KhyleProject.mk" clean
