# Enterprise SaaS Design Brief

_Started 2026-07-13 23:17 UTC_

---

## User

<system-info comment="Only acknowledge these if relevant">
Project title is now "# INT AI – Product Vision & Design Brief????## Overview????INT AI is an AI Opera"
The project currently has no files except possibly dotfiles — a `list_files` on the project root would return nothing else.
Current date is now July 13, 2026
</system-info>

<default aesthetic_system_instructions>
The user has not attached a design system. If they have ALSO not attached references or art direction, and the project is empty, you must ASK the user what visual aesthetic they want. Use the questions_v2 tool to ask about preferred vibe, audience, colors, type, mood, etc. Do NOT just pick your own visual aesthetic without getting the user's aesthetic input -- this is how you get slop!

Once answered, use this guidance when creating designs:
- Choose a type pairing from web-safe set or Google Fonts. Helvetica is a good choice. Avoid hard-to-read or overly stylized fonts. Use 1-3 fonts only.
- Foreground and background: choose a color tone (warm, cool, neutral, something in-between). Use subtly-toned whites and blacks; avoid saturations above 0.02 for whites.
- Accents: choose 0-2 additional accent colors using oklch. All accents should share same chroma and lightness; vary hue.
- NEVER write out an SVG yourself that's more complicated than a square, circle, diamond, etc.
- For imagery, never hand-draw SVGs; use subtly-striped SVG placeholders instead with monospace explainers for what should be dropped there (e.g. “product shot”)

CRITICAL: ignore default aesthetic entirely if given other aesthetic instructions like reference images, design systems or guidance, or if there are files in the project already.
</default aesthetic_system_instructions>

<pasted_text name="Pasted text (545 lines)">
# INT AI – Product Vision &amp; Design Brief

## Overview

INT AI is an AI Operating System for businesses, institutions, and individuals. Rather than forcing users to choose between dozens of AI models and platforms, INT AI provides a single intelligent workspace where every AI capability is accessible through one interface.

The platform acts as an intelligent orchestration layer that understands the user's request, determines the best AI model or combination of models for the task, executes the workflow, and returns the final result. Users focus on solving problems—not on selecting models.

INT AI is not another chatbot. It is the central hub through which all AI activity is managed, secured, optimized, and monitored.

---

# Vision

To become the universal operating system that enables every organization to securely leverage the world's best AI models through one intelligent platform.

INT AI should eliminate the complexity of AI adoption by providing one interface, one workspace, one source of truth, and one intelligent routing engine capable of selecting the right model for every task.

---

# Core Philosophy

The user should never need to know which AI model is being used.

Instead of asking:

*"Should I use ChatGPT, Claude, Gemini, Grok, Perplexity, or another model?"*

The user simply describes what they want to accomplish.

INT AI analyzes the request, evaluates the available models, considers cost, speed, capabilities, and quality, then automatically selects the most appropriate AI or orchestrates multiple models together to produce the best possible outcome.

The experience should feel effortless, intelligent, and invisible.

---

# Target Audience

INT AI is designed for:

* Individuals who use multiple AI tools.
* Freelancers and consultants.
* Startups.
* Small and medium-sized businesses.
* Large enterprises.
* Educational institutions.
* Government organizations.
* Non-profit organizations.

Every organization that wants centralized AI management should be able to use INT AI.

---

# The Problems INT AI Solves

Organizations today face several challenges:

* Employees use different AI platforms with no standardization.
* AI subscriptions become expensive and difficult to manage.
* Sensitive company information is shared across multiple external services.
* There is no visibility into AI usage or costs.
* Teams duplicate prompts and workflows.
* Employees waste time choosing which AI model to use.
* Knowledge is fragmented across documents and software.
* AI adoption lacks governance and security.

INT AI solves these challenges through intelligent orchestration and centralized management.

---

# Core Product Experience

The platform should revolve around a single universal workspace.

A user logs in and simply asks:

* "Analyze these financial statements."
* "Generate a marketing campaign."
* "Review this contract."
* "Create a mobile application."
* "Research competitors."
* "Generate social media content."
* "Translate this document."
* "Build a project plan."

INT AI determines:

* what type of task it is,
* which AI models perform best,
* whether multiple models should collaborate,
* whether company knowledge should be consulted,
* and how to optimize cost and response quality.

The entire process happens automatically.

---

# Intelligent AI Routing Engine

The routing engine is the heart of INT AI.

It continuously evaluates:

* AI capabilities
* response quality
* pricing
* latency
* context window
* reasoning ability
* coding performance
* vision capabilities
* research capabilities
* image generation
* speech generation
* document understanding

For example:

Coding requests may be routed to one model.

Deep research may be routed to another.

Image generation may use a specialized image model.

Complex workflows may involve several models working together.

Users never manually select providers unless they explicitly want to.

---

# Multi-Model Collaboration

Some requests require more than one AI.

INT AI should orchestrate collaborative workflows automatically.

For example:

A user requests:

"Launch a new business."

The platform could:

* Generate the business strategy.
* Improve the writing.
* Verify facts.
* Design a logo.
* Generate website copy.
* Produce marketing content.
* Create presentation slides.
* Produce a voice-over.
* Generate promotional images.

The user receives one unified result despite multiple AI systems working behind the scenes.

---

# AI Specialists

Rather than offering one generic assistant, INT AI should provide specialized AI experts.

Examples include:

Business Consultant

Marketing Strategist

Software Architect

Frontend Developer

Backend Developer

Cybersecurity Expert

Financial Analyst

HR Advisor

Legal Assistant

Sales Coach

SEO Expert

Content Writer

Data Scientist

Product Manager

UX Designer

Research Analyst

These specialists use the routing engine while maintaining domain-specific expertise and workflows.

---

# AI Teams

Organizations should be able to build collaborative AI teams.

Examples:

Marketing Team

* Brand Strategist
* Copywriter
* SEO Specialist
* Advertising Expert
* Graphic Designer

Software Team

* Solution Architect
* Backend Engineer
* Frontend Engineer
* QA Engineer
* Security Specialist

Executive Team

* Financial Advisor
* Strategy Consultant
* Business Analyst
* Operations Manager

Each AI specialist can collaborate automatically.

---

# Company Knowledge

Organizations should upload internal knowledge such as:

Policies

Contracts

Training manuals

Employee handbooks

Product documentation

Technical documentation

Meeting notes

Research papers

Financial reports

Standard operating procedures

INT AI indexes this information securely so every authorized employee can ask questions in natural language.

---

# Connected Workspace

INT AI should integrate with major business platforms including:

Google Workspace

Microsoft 365

Notion

Slack

Discord

GitHub

Jira

ClickUp

HubSpot

Salesforce

Dropbox

OneDrive

Google Drive

Email providers

Calendars

Cloud storage

The AI becomes capable of understanding and acting on company information across connected systems.

---

# Prompt Library

Organizations should maintain a centralized prompt library.

Teams can create, organize, categorize, reuse, and share high-quality prompts.

Prompts become organizational assets instead of remaining personal knowledge.

---

# Workflow Automation

Users should build AI-powered workflows without writing code.

Example:

Invoice uploaded

↓

Data extracted

↓

Categorized

↓

Stored

↓

Manager notified

↓

Report updated

↓

Summary generated

↓

Email sent

The platform should support reusable automation templates.

---

# AI Memory

Each user should have persistent memory.

The system remembers:

Preferred writing style

Frequently used documents

Projects

Departments

Communication tone

Favorite workflows

Preferences

This allows AI interactions to become increasingly personalized over time.

---

# Cost Optimization

One of INT AI's strongest differentiators should be intelligent cost management.

The routing engine should automatically consider:

Model pricing

Response quality

Speed

Token usage

Expected complexity

Whenever possible, the platform should choose the most cost-effective model without compromising quality.

Organizations should clearly see the savings generated by intelligent routing.

---

# Security and Governance

Security must be enterprise-grade.

The platform should include:

Role-based access control

Multi-factor authentication

Single Sign-On

Encrypted API key storage

Encrypted data

Audit logs

Permission management

Workspace isolation

Department-level permissions

Document permissions

Compliance readiness

Administrative controls

Organizations should remain in complete control of their data.

---

# Administration Dashboard

Administrators should monitor:

Total AI usage

Department activity

User activity

Monthly spending

Token consumption

Most used AI models

Cost savings

Popular workflows

Prompt usage

Connected services

System health

Adoption metrics

The dashboard should transform AI from an invisible expense into a measurable business capability.

---

# API Key Management

Organizations should have two deployment options.

Bring Your Own API Keys:

Companies connect their existing OpenAI, Anthropic, Google, or other provider accounts.

Managed Platform:

Organizations purchase usage directly through INT AI while the platform manages provider relationships.

This flexibility supports both cost-conscious users and enterprises seeking operational simplicity.

---

# Marketplace

INT AI should eventually include a marketplace where developers and organizations can publish:

AI Specialists

Automation templates

Industry workflows

Prompt packs

Integrations

Knowledge packs

Custom connectors

Organizations can install capabilities with minimal setup.

---

# User Experience

The interface should communicate intelligence, simplicity, and trust.

Key design principles include:

Minimalist

Modern

Professional

Fast

Clean

Enterprise-ready

Calm

Highly intuitive

The interface should avoid overwhelming users with technical concepts.

Complexity belongs behind the scenes.

The user should feel as though they are interacting with a single exceptionally intelligent assistant.

---

# Long-Term Vision

INT AI should become the central AI infrastructure layer for modern organizations.

Instead of replacing existing AI providers, it orchestrates them.

Instead of competing with individual models, it continuously selects the best one.

Instead of requiring organizations to adapt to AI, it adapts AI to each organization.

The ultimate goal is for every employee, regardless of technical expertise, to have immediate access to the world's most capable AI systems through one secure, intelligent, and unified platform.

INT AI should become the operating system through which organizations create, analyze, automate, collaborate, innovate, and make decisions using artificial intelligence.

</pasted_text>

<!-- The user explicitly selected the following skills for this project, as attachments to their message. These are not optional context — they define how you work. Use them. -->
<attached-skill name="Design Components">
This project uses Design Components: every design is a single streaming `Name.dc.html` file. The full authoring spec is in your system prompt under "Writing code — Design Components" — follow it. Author and edit `.dc.html` content with the `dc_write`, `dc_html_str_replace`, `dc_js_str_replace`, and `dc_set_props` tools (not `write_file`; `str_replace_edit` works but won't stream); template edits stream into the live preview as you type.
</attached-skill>


<system-reminder>Auto-injected reminder (ignore if not relevant): do not recreate copyrighted or branded UI unless the user's email domain matches that company. Create original designs instead.</system-reminder>

## Assistant

_[tool: questions_v2]_

## User

Questions answered:
- output_type: the main interface
- audience: companies, instituitions
- length: not a deck
- aesthetic: Sleek enterprise SaaS (dark, techy)
- color: 0
- logo_brand: not yet
- focus: Clarity of the concept for a first-time reader, Visual polish / aesthetics

## Assistant

_[tool: update_todos]_

_[tool: dc_write]_

_[tool: update_todos]_

_[tool: ready_for_verification]_

_[tool: dc_html_str_replace]_

_[tool: update_todos]_

Fixed sidebar overflow. Design complete: dark enterprise workspace with routing/orchestration UI, specialist sidebar, task composer, and right-panel cost/model breakdown.

_[tool: update_todos]_

Done — INT AI workspace UI built and fixed. Safe stopping point; no remaining tasks.

## User

make the design better informations proccessed in the backend should be shown as how claude does

## Assistant

_[tool: update_todos]_

_[tool: dc_html_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: update_todos]_

## Assistant

_[tool: ready_for_verification]_

Backend trace now styled as a collapsible reasoning thread, per-step model tag + specialist + trace note — closer to Claude's thinking/tool-use presentation.

## User

it seems too busy lets see whats can be rearranged then main colours should be white and black

## Assistant

## Assistant

## Assistant

## User

make the main theme to be black

## Assistant

_[tool: dc_write]_

_[tool: ready_for_verification]_

Switched to a black theme, decluttered the routing trace, and removed the right panel.

