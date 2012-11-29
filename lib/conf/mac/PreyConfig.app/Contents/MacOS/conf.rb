#!/usr/bin/env ruby

############################
# Prey OSX Configurator
# Copyright (c) Fork Limited
# Written by Tomás Pollak
# GPLv3 Licensed
############################

require 'osx/cocoa'
include OSX

APP_NAME  = 'Prey Configurator'
HEIGHT = 400
WIDTH  = 500
CENTER = WIDTH/2

EMAIL_REGEX = /[A-Z0-9\._%-]+@([A-Z0-9-]+\.)+[A-Z]{2,4}\z/i

PREY_CONFIG = File.expand_path(File.dirname(__FILE__) + '/../../../../../../bin/prey config')
LOGO   = File.expand_path(File.dirname(__FILE__) + '/../../../../pixmaps/prey-text.png')

TABS = ['welcome', 'new_user', 'existing_user', 'success']

TEXTS = {
	'welcome' => 'Welcome wise friend. Please choose your destiny.',
	'new_user' => "Please type in your info and we'll sign you up for a new account.",
	'existing_user' => 'Please type in your credentials.',
	'success' => 'All good!'
}

class ConfigWindow < NSWindow

  def windowShouldClose(sender)
    OSX::NSApp.stop(nil)
    false
  end

end

class ConfigDelegate < NSObject

	attr_reader :app, :window, :tabs, :chooser, :inputs

  def set_app(app)
		@app = app
	end

  def applicationDidFinishLaunching(aNotification)
    @inputs = {}
		drawWindow
		drawImage(LOGO, [350, 73, CENTER-(350/2), 310], window.contentView)
		drawButtons
		drawTabs
		setTab(0)
  end

	def getFrame(width, height, x = 0, y = 0)
		NSRect.new(NSSize.new(x, y), NSSize.new(width, height))
	end

	def drawWindow
		frame = getFrame(WIDTH, HEIGHT, 300, 200)
	  @window = ConfigWindow.alloc.initWithContentRect_styleMask_backing_defer(frame, 
#			NSTexturedBackgroundWindowMask |
			NSTitledWindowMask |
	  	NSClosableWindowMask | 
	  	NSMiniaturizableWindowMask, NSBackingStoreBuffered, 1)

	  window.setTitle(APP_NAME)
		window.setDelegate(self)
	  window.display
	  window.orderFrontRegardless
		# win.makeKeyWindow
		# win.makeKeyAndOrderFront(self)
		window
	end
	
	def drawImage(file, coords, view)
    imageView = NSImageView.alloc.initWithFrame(getFrame(*coords))
    image = NSImage.alloc.initWithContentsOfFile(LOGO)
    imageView.setImage(image)
		view.addSubview(imageView)
	end
	
	def drawButtons
		@prev = drawButton([300.0, 10.0], [80, 30], 'Previous', 'previous_tab:')
		@next = drawButton([400.0, 10.0], [80, 30], 'Next', 'next_tab:')
		@prev.setHidden(true)
		window.makeFirstResponder(@next)
	end
	
	def drawRadio(title, default, tag, coords)
    checkbox = NSButton.alloc.initWithFrame(NSRect.new(NSSize.new(*coords), NSSize.new(94,18)))
    checkbox.setButtonType(NSRadioButton)
    checkbox.setTitle(title)
    checkbox.setState(default)
    checkbox.setTag(tag)
		checkbox
	end
	
	def drawChooser
    cell = NSButtonCell.alloc.init
    cell.setTitle "Watermelons"
    cell.setButtonType(NSRadioButton)

    frame = getFrame(100.0, 100.0, 20.0, 50.0)
		@chooser = matrix = NSMatrix.alloc.initWithFrame_mode_prototype_numberOfRows_numberOfColumns(frame, 
			NSRadioModeMatrix,
			cell,
			2,
			1
		)

		matrix.setIntercellSpacing(NSSize.new(50, 20.0))
    # matrix.setCellSize_((posSize[2], 15))

		arr = matrix.cells
		arr.objectAtIndex(0).setTitle('New user')
		arr.objectAtIndex(1).setTitle('Existing user')

		matrix
	end
	
	def drawButton(size, position, text, action)
	  button = NSButton.alloc.initWithFrame(NSRect.new(NSSize.new(*size), NSSize.new(*position)))
	  window.contentView.addSubview(button)
	  button.setBezelStyle(NSTexturedRoundedBezelStyle)
	  button.setTitle(text)
	  button.setTarget(self)
	  button.setEnabled(true)
	  button.setAction(action)
	  button
	end

	def drawLabel(text, coords)
    field = NSTextField.alloc.initWithFrame(getFrame(*coords))
    field.setStringValue(text)
    field.setBezeled(false)
    field.setBordered(false)
    field.setDrawsBackground(false)
    field.setEditable(false)
		field
	end

	def drawInput(type, id, title, x, y)
		klass = type == 'password' ? NSSecureTextField : NSTextField
		label = drawLabel(title, [200, 15, x, y+30])
    input = klass.alloc.initWithFrame(getFrame(200, 25, x, y))
		input.setBezelStyle(NSTextFieldSquareBezel)
    input.setEditable(true)
    input.setSelectable(true)
    # input.setAction_("enter_pressed")
    # input.setTarget(self)
    input.setEnabled(true)
		@inputs[id] = input
		return label, input
	end
	
	def drawTextInput(id, title, x, y)
		return drawInput('text', id, title, x, y)
	end

	def drawPasswordInput(id, title, x, y)
		return drawInput('password', id, title, x, y)
	end

	def drawTab(name)
    tab = NSTabViewItem.alloc().initWithIdentifier_(name)
    tab.setLabel(name)

		text = drawLabel(TEXTS[name], [400, 50, 15, 170])
		tab.view.addSubview(text)

		if name == 'welcome'
			drawWelcome(tab, name)
		elsif name == 'new_user'
			drawNewUser(tab, name)
		elsif name == 'existing_user'
			drawExistingUser(tab, name)
		elsif name == 'success'
			drawSuccess(tab, name)
		else
			raise 'Unknown tab name: ' + name
		end

		tab
	end
	
	def drawTabs
		@tabs = NSTabView.alloc.initWithFrame(getFrame(470, 250, 15, 50))
		TABS.each_with_index do |name, i|
			tab = drawTab(name)
			# tab.view.setHidden(true) if i == (TABS.count-1)
			tabs.addTabViewItem(tab)
		end
		tabs.setTabViewType(NSNoTabsBezelBorder)
		# tabs.setDrawsBackground(true)
		window.contentView.addSubview(tabs)
	end
	
	def getCurrentTab
    item = tabs.selectedTabViewItem()
    tabs.indexOfTabViewItem(item)
	end

	def setTab(index)
  	tabs.selectTabViewItemAtIndex(index)
	end
	
	def getDestiny
		x = chooser.selectedRow()
		return x == 0 ? 1 : 2
	end
	
	def changeTab(dir)
		index = getCurrentTab

		if index == 0  # first page
			@prev.setHidden(false)
			dir = getDestiny
		elsif index == 1 && dir == 1
			dir = 2
		elsif index == 2 && dir == -1
			dir = -2
		elsif (index == (TABS.count-1) && dir == 1)
			return speak 'Last page'
		end

		target = index + dir
		if target == 0 # back to welcome
			@prev.setHidden(true)
		elsif target == (TABS.count - 1) # sending info
			# @next.setHidden(true)
			return submitData(index)
		end
		setTab(target)
	end
	
	def showAlert(message)
	 alert = NSAlert.alloc.init
	 alert.setMessageText(message)
	 # text = 'Hello there'
	 # alert.setInformativeText(text)
	 # NSRunAlertPanel(message, "Aloha", "OK", nil, nil);
	 # alert.addButtonWithTitle(cancelButton)
	 alert.runModal()
	end
	
	def showSuccess
		@prev.setHidden(true)
		@next.setTitle('Close')
		@next.setAction('terminate:')
		setTab(TABS.count-1) # last one
	end
	
	def submitData(index)
		if TABS[index] == 'new_user'
			userSignup()
		else
			userVerify()
		end
	end
	
	def get_value(input_id)
		inputs[input_id].objectValue
	end
	
	def validate_email(email)
		return email.to_s[EMAIL_REGEX] ? true : showAlert('Email address is not valid.') && false
	end

	def validate_present(what, text)
		return text != '' ? true : showAlert("Please type a valid #{what}.") && false
	end

	def validate_length(what, count, text)
		return text.length >= count ? true : showAlert("#{what} needs to be at least #{count} chars long.") && false
	end
	
	def userSignup
		name, email, pass = get_value('name'), get_value('email'), get_value('pass')
		validate_present('Name', name) and validate_email(email) and validate_length('Password', 6, pass) or return

		code, out = run("signup -n '#{name}' -e '#{email}' -p '#{pass}'")
		if code == 1
			showAlert(out.split("\n").last)
		else
			showSuccess
		end
	end
	
	def userVerify
		email, pass = get_value('existing_email'), get_value('existing_pass')
		validate_email(email) and validate_length('Password', 6, pass) or return

		code, out = run("authorize --email '#{email}' --password '#{pass}'")
		if code == 1
			showAlert(out.split("\n").last)
		else
			showSuccess
		end
	end
	
	def run(args)
		cmd = "#{PREY_CONFIG} account #{args}"
		out = `#{cmd}`
		code = $?.exitstatus
		return code, out 
	end

  def previous_tab(sender)
		changeTab(-1)
  end

  def next_tab(sender)
		changeTab(1)
  end

	def terminate(sender)
    OSX::NSApp.stop(nil)
	end

  def speak(str)
    script = NSAppleScript.alloc.initWithSource("say \"#{str}\"")
    script.performSelector_withObject('executeAndReturnError:', nil)
  end
	
	def drawWelcome(tab, name)
		matrix = drawChooser
		tab.view.addSubview(matrix)
		return
		# cb1 = drawRadio('New user', true, 1, [100, 100])
		# cb2 = drawRadio('Existing user', false, 1, [200, 100])
		# tab.view.addSubview(cb1)
		# tab.view.addSubview(cb2)
	end
	
	def drawNewUser(tab, name)
		elements = []
		elements << drawTextInput('name', 'Your name', 15, 140)
		elements << drawTextInput('email', 'Email', 15, 85)
		elements << drawPasswordInput('pass', 'Password', 15, 30)
		elements.flatten.each do |el|
			tab.view.addSubview(el)			
		end
	end

	def drawExistingUser(tab, name)
		elements = []
		elements << drawTextInput('existing_email', 'Email', 15, 140)
		elements << drawPasswordInput('existing_pass', 'Password', 15, 85)
		elements.flatten.each do |el|
			tab.view.addSubview(el)			
		end
	end

	def drawSuccess(tab, name)
		
	end

end

def setupMenus(app)
  menubar = NSMenu.new
	appMenuItem = NSMenuItem.alloc.init
	menubar.addItem(appMenuItem)
	app.setMainMenu(menubar)
	
	appmenu = NSMenu.new
	quitMenuItem = NSMenuItem.alloc.initWithTitle_action_keyEquivalent('Quit', 'terminate:', 'q')
	
	appmenu.addItem(quitMenuItem)
	appMenuItem.setSubmenu(appmenu)
end

def openConfig
  app = NSApplication.sharedApplication
	app.setActivationPolicy(NSApplicationActivationPolicyRegular) # allows raising window
  app.setDelegate ConfigDelegate.new
  setupMenus(app)
	app.activateIgnoringOtherApps(true)

  trap('SIGINT') { puts "bye." ; exit 0 }
  app.run
end

if $0 == __FILE__ then 
	openConfig
end