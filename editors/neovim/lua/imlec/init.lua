-- imlec-typer — Neovim Lua Plugin
-- Particle effects at your cursor while typing.
-- Install: copy to ~/.config/nvim/lua/imlec/init.lua
-- Require: require('imlec').setup()

local M = {}

-- ── Config ─────────────────────────────────────────────────

local defaults = {
  enabled = true,
  preset = "typewriter",
  content_mode = "glyph",
  color_mode = "palette",
  color_fixed = "#ff2d95",
  color_palette = { "#ff2d95", "#ff9f1c", "#2de2e6", "#a06cff", "#f9f871" },
  count = 6,
  size = 14,
  gravity = 320,
  speed = 130,
  spread_deg = 140,
  lifetime_ms = 500,
  glow = true,
  explode = true,
  trail = false,
  rotate_3d = false,
  combo_enabled = true,
  combo_max_multiplier = 2.5,
  emoji_set = { "🔥", "💥", "✨", "⚡", "🎯", "💻", "🚀", "⭐" },
  symbol_set = { "{", "}", ";", "/", "<", ">", "=", "+", "-", "*", "&", "|", "!", "?" },
}

local PRESETS = {
  matrix =      { content = "symbol", color = "#00ff41", count = 4,  gravity = 80,  speed = 60,  spread = 140 },
  fireworks =   { content = "emoji",  color = "rainbow", count = 8,  gravity = -40, speed = 100, spread = 360 },
  typewriter =  { content = "glyph",  color = "#d4a373", count = 1,  gravity = 250, speed = 50,  spread = 60  },
  rainbow =     { content = "glyph",  color = "rainbow", count = 3,  gravity = 150, speed = 120, spread = 180 },
  minimal =     { content = "shape",  color = "#888888", count = 2,  gravity = 400, speed = 80,  spread = 90  },
}

local SHAPES = { "●", "■", "▲", "◆", "★", "✦", "⬡" }

local config = {}
local particles = {}
local timer = nil
local combo = 0
local last_key_time = 0
local ns_id = nil

-- ── Utils ──────────────────────────────────────────────────

local function rand(min, max)
  return min + math.random() * (max - min)
end

local function hsl_to_hex(h, s, l)
  h = h / 360
  local function hue2rgb(p, q, t)
    if t < 0 then t = t + 1 end
    if t > 1 then t = t - 1 end
    if t < 1/6 then return p + (q - p) * 6 * t end
    if t < 1/2 then return q end
    if t < 2/3 then return p + (q - p) * (2/3 - t) * 6 end
    return p
  end
  local r, g, b
  if s == 0 then
    r, g, b = l, l, l
  else
    local q = l < 0.5 and l * (1 + s) or l + s - l * s
    local p = 2 * l - q
    r = hue2rgb(p, q, h + 1/3)
    g = hue2rgb(p, q, h)
    b = hue2rgb(p, q, h - 1/3)
  end
  return string.format("#%02x%02x%02x",
    math.floor(r * 255), math.floor(g * 255), math.floor(b * 255))
end

local function resolve_color(cfg)
  local mode = cfg.color_mode
  if mode == "rainbow" then
    return hsl_to_hex(math.random() * 360, 0.8, 0.6)
  elseif mode == "palette" then
    local pal = cfg.color_palette
    return pal[math.random(1, #pal)]
  elseif mode == "gradient" then
    local pal = cfg.color_palette
    return pal[math.random(1, #pal)]
  else
    return cfg.color_fixed
  end
end

-- ── Particle System ────────────────────────────────────────

local function spawn(text, row, col, cfg)
  local spread = math.rad(cfg.spread_deg)
  local dir = -math.pi / 2 + (math.random() - 0.5) * spread
  local spd = cfg.speed * rand(0.7, 1.3)

  table.insert(particles, {
    text = text,
    row = row,
    col = col,
    vx = math.cos(dir) * spd,
    vy = math.sin(dir) * spd,
    life = cfg.lifetime_ms,
    max_life = cfg.lifetime_ms,
    gravity = cfg.gravity,
    color = resolve_color(cfg),
    size = cfg.size,
    glow = cfg.glow,
  })
end

local function update(dt)
  local alive = {}
  for _, p in ipairs(particles) do
    p.life = p.life - dt
    if p.life > 0 then
      local drag = 0.02
      p.vx = p.vx * (1 - drag)
      p.vy = p.vy * (1 - drag) + p.gravity * (dt / 1000)
      p.row = p.row + p.vy * (dt / 1000) / 20
      p.col = p.col + p.vx * (dt / 1000) / 10
      table.insert(alive, p)
    end
  end
  particles = alive

  if ns_id then
    vim.api.nvim_buf_clear_namespace(0, ns_id, 0, -1)
  end
  for _, p in ipairs(particles) do
    local opacity = math.max(0, p.life / p.max_life)
    if opacity > 0.01 then
      local hl_group = "ImlecParticle_" .. tostring(math.floor(opacity * 10))
      vim.cmd(string.format("highlight %s guifg=%s", hl_group, p.color))
      local row = math.floor(p.row)
      local col = math.floor(p.col)
      if row >= 0 and col >= 0 then
        pcall(function()
          vim.api.nvim_buf_set_extmark(0, ns_id, row, col, {
            virt_text = { { p.text, hl_group } },
            virt_text_pos = "overlay",
            priority = 999,
          })
        end)
      end
    end
  end

  if #particles > 0 then
    timer = vim.defer_fn(function() update(16) end, 16)
  else
    timer = nil
  end
end

-- ── Content Resolver ───────────────────────────────────────

local function get_content(cfg, typed_char)
  local mode = cfg.content_mode
  if mode == "glyph" then
    return typed_char or "●"
  elseif mode == "random_digit" then
    return tostring(math.random(0, 9))
  elseif mode == "random_letter" then
    local letters = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"
    return letters:sub(math.random(1, #letters), math.random(1, #letters))
  elseif mode == "random_symbol" then
    local syms = cfg.symbol_set
    return syms[math.random(1, #syms)]
  elseif mode == "emoji" then
    local em = cfg.emoji_set
    return em[math.random(1, #em)]
  else
    return SHAPES[math.random(1, #SHAPES)]
  end
end

-- ── Keystroke Handler ──────────────────────────────────────

local function on_text_changed()
  if not config.enabled then return end

  local now = vim.loop.now()
  local combo_window = 600
  if now - last_key_time < combo_window then
    combo = combo + 1
  else
    combo = 1
  end
  last_key_time = now

  local preset = PRESETS[config.preset] or PRESETS.typewriter
  local cfg = vim.tbl_extend("force", config, {
    content_mode = config.content_mode ~= "glyph" and config.content_mode or preset.content,
    count = config.count,
    gravity = config.gravity,
    speed = config.speed,
    spread_deg = config.spread_deg,
  })

  if config.combo_enabled then
    local mult = math.min(1 + combo * 0.05, config.combo_max_multiplier)
    cfg.count = math.floor(cfg.count * mult)
  end

  local cursor = vim.api.nvim_win_get_cursor(0)
  local row = cursor[1] - 1
  local col = cursor[2]

  local line = vim.api.nvim_get_current_line()
  local typed = col > 0 and line:sub(col, col) or " "

  local text = get_content(cfg, typed)
  spawn(text, row, col, cfg)

  if not timer then
    ns_id = ns_id or vim.api.nvim_create_namespace("imlec-typer")
    timer = vim.defer_fn(function() update(16) end, 16)
  end
end

-- ── Commands ───────────────────────────────────────────────

vim.api.nvim_create_user_command("ImlecToggle", function()
  config.enabled = not config.enabled
  vim.notify("imlec-typer " .. (config.enabled and "enabled" or "disabled"))
end, {})

vim.api.nvim_create_user_command("ImlecPreset", function(opts)
  config.preset = opts.args
  vim.notify("imlec-typer preset: " .. opts.args)
end, { nargs = 1, complete = function() return vim.tbl_keys(PRESETS) end })

vim.api.nvim_create_user_command("ImlecSettings", function()
  vim.cmd("edit " .. vim.fn.stdpath("config") .. "/lua/imlec/config.lua")
end, {})

-- ── Setup ──────────────────────────────────────────────────

function M.setup(user_config)
  config = vim.tbl_deep_extend("force", defaults, user_config or {})
  ns_id = vim.api.nvim_create_namespace("imlec-typer")

  vim.api.nvim_create_autocmd("TextChangedI", {
    group = vim.api.nvim_create_augroup("ImlecTyper", { clear = true }),
    callback = on_text_changed,
  })

  vim.api.nvim_create_autocmd("TextYankPost", {
    group = vim.api.nvim_create_augroup("ImlecTyperYank", { clear = true }),
    callback = function() end,
  })
end

return M
