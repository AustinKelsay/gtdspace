//! Seed data and templates for GTD Space initialization
//!
//! This module contains all the template content and seed data used when
//! initializing a new GTD Space or seeding example content.

use chrono::{Datelike, Local, Timelike, Weekday};

/// Template content for the Horizons/Areas of Focus file
pub const AREAS_OF_FOCUS_TEMPLATE: &str = r#"# Areas of Focus (20,000 ft)

## What are Areas of Focus?

Areas of Focus are the ongoing roles and responsibilities you need to maintain in your life. Unlike projects which have specific outcomes and endpoints, these are areas that require continuous attention and balance.

## My Areas of Focus

### 🏠 Personal
- **Health & Fitness** - Physical wellbeing, exercise, nutrition, sleep
- **Family & Relationships** - Quality time with loved ones, maintaining connections
- **Personal Development** - Learning, skills growth, self-improvement
- **Finances** - Budget management, savings, investments

### 💼 Professional
- **Current Role Responsibilities** - Core job functions and deliverables
- **Team Leadership** - Supporting and developing team members
- **Professional Development** - Career growth, networking, skills advancement
- **Strategic Initiatives** - Long-term improvements and innovations

### 🌟 Life Management
- **Home & Environment** - Household maintenance, organization, comfort
- **Admin & Legal** - Documentation, compliance, administrative tasks
- **Community & Service** - Volunteer work, community involvement

## Review Questions
- Which areas are thriving? Which need more attention?
- Are all my projects aligned with these areas?
- What areas am I neglecting that need focus?
- Are there areas I should add or remove?

## Notes
Update this list during your weekly review to ensure you're maintaining balance across all important areas of your life.
"#;

/// Template content for the Horizons/Goals file
pub const GOALS_TEMPLATE: &str = r#"# Goals (30,000 ft)

## What are Goals?

Goals are specific achievements you want to accomplish within the next 1-2 years. They provide direction for your projects and help you make decisions about what to focus on.

## My 1-2 Year Goals

### Personal Goals
- [ ] **Health**: Reach and maintain target weight of ___
- [ ] **Fitness**: Complete a half-marathon
- [ ] **Learning**: Become conversationally fluent in [language]
- [ ] **Financial**: Build emergency fund of 6 months expenses

### Professional Goals
- [ ] **Career**: Achieve promotion to [position]
- [ ] **Skills**: Earn certification in [technology/skill]
- [ ] **Impact**: Lead successful implementation of [major initiative]
- [ ] **Network**: Build relationships with 20+ industry leaders

### Relationship Goals
- [ ] **Family**: Take family on international vacation
- [ ] **Community**: Establish regular volunteer commitment
- [ ] **Social**: Host monthly gatherings with friends

## Success Metrics
- How will I know when I've achieved each goal?
- What milestones can I set along the way?
- Which goals are most important if I can't achieve all?

## Review Schedule
Review quarterly to assess progress and adjust as needed.
"#;

/// Template content for the Horizons/Vision file
pub const VISION_TEMPLATE: &str = r#"# Vision (40,000 ft)

## What is Vision?

Your 3-5 year vision is a vivid picture of where you want to be. It's aspirational yet achievable, providing long-term direction for your goals and decisions.

## My 3-5 Year Vision

### Life Snapshot
*Imagine it's 3-5 years from now. You're living your ideal life. Describe what you see...*

**Where I'm Living:**
- Location, type of home, environment

**What I'm Doing Professionally:**
- Role, responsibilities, impact, achievements

**My Relationships:**
- Family dynamics, friendships, community connections

**My Health & Wellbeing:**
- Physical fitness, mental health, daily routines

**My Finances:**
- Income level, assets, financial security

**My Personal Growth:**
- Skills mastered, experiences gained, wisdom earned

### Key Themes
- What patterns emerge from this vision?
- What values are being expressed?
- What changes from today are most significant?

### Success Factors
- What capabilities do I need to develop?
- What resources will I need?
- What obstacles might I face?

## Affirmation
Write a present-tense statement as if this vision is already true:
*"I am..."*

## Review
Review annually and adjust based on life changes and evolved perspectives.
"#;

/// Template content for the Horizons/Purpose & Principles file
pub const PURPOSE_PRINCIPLES_TEMPLATE: &str = r#"# Purpose & Principles (50,000 ft)

## What are Purpose & Principles?

Your purpose is your "why" - the ultimate reason behind everything you do. Your principles are the core values that guide your decisions and actions. Together, they form the foundation of your life's direction.

## My Purpose

### Life Mission Statement
*Why do I exist? What am I here to contribute?*

[Write your personal mission statement here]

### Core Purpose Elements
- **To Create**: What do I want to bring into existence?
- **To Connect**: How do I want to relate to others?
- **To Contribute**: What legacy do I want to leave?
- **To Experience**: What do I want to learn and explore?

## My Principles & Values

### Core Values (Top 5-7)
1. **[Value]** - [What this means to me]
2. **[Value]** - [What this means to me]
3. **[Value]** - [What this means to me]
4. **[Value]** - [What this means to me]
5. **[Value]** - [What this means to me]

### Guiding Principles
*The non-negotiable standards by which I live:*

- I always...
- I never...
- I believe...
- I stand for...

### Decision Filters
When facing difficult decisions, I ask:
- Does this align with my purpose?
- Does this honor my values?
- Will I be proud of this choice in 10 years?
- Does this move me toward or away from who I want to be?

## Integration
- How do my current projects reflect my purpose?
- Where am I compromising my principles?
- What changes would bring more alignment?

## Reflection
This is the deepest level of GTD thinking. Review annually or when facing major life decisions.
"#;

/// Template content for the Welcome to GTD Space file
pub const WELCOME_TEMPLATE: &str = r#"# Welcome to Your GTD Space

This is your personal Getting Things Done (GTD) space. The directory structure has been set up to help you organize your life:

## 🎯 Horizons
Your higher-level perspectives and life direction:
- **Areas of Focus** (20,000 ft) - Ongoing responsibilities and roles
- **Goals** (30,000 ft) - 1-2 year objectives  
- **Vision** (40,000 ft) - 3-5 year aspirations
- **Purpose & Principles** (50,000 ft) - Core values and life mission

## 📁 Projects
Contains all your active projects. Each project is a folder with:
- A README.md file containing project details
- Individual action files (markdown) for tasks

### Project Structure:
```
Projects/
├── Project Name/
│   ├── README.md           # Project overview and metadata
│   ├── Action 1.md        # Individual action file
│   ├── Action 2.md        # Another action
│   └── ...
```

## 🔄 Habits
Your recurring habits and routines. Each habit is a markdown file with:
- Frequency (daily, weekly, etc.)
- Status tracking
- History log

## 💭 Someday Maybe
Ideas and projects you might want to do in the future but aren't committed to yet.

## 🗄️ Cabinet
Reference materials you want to keep but don't require action. This could include:
- Important documents
- Reference notes
- Templates
- Resources

## Getting Started

1. **Capture** - Use the Quick Add feature to capture thoughts and tasks
2. **Clarify** - Process items into projects and actions
3. **Organize** - Keep everything in its proper place
4. **Reflect** - Review regularly to stay on track
5. **Engage** - Trust your system and take action

## Tips

- Use the sidebar to quickly navigate between sections
- Click on a project to see all its actions
- Add due dates and focus dates to actions for better planning
- Review your GTD space weekly to keep it current

Happy organizing! 🎯
"#;

/// Template for Someday Maybe - Learn a New Language
pub const SOMEDAY_LEARN_LANGUAGE_TEMPLATE: &str = r#"# Learn a New Language

## Idea

I've always wanted to learn Spanish to connect better with Spanish-speaking communities and travel more confidently in Latin America and Spain.

## Why it matters

- Opens up communication with 500+ million Spanish speakers worldwide
- Enhances travel experiences in 20+ countries
- Cognitive benefits of bilingualism
- Career advancement opportunities
- Cultural enrichment and understanding

## Next steps when ready

- [ ] Research language learning methods (apps, classes, tutors)
- [ ] Set a realistic timeline and daily practice goal
- [ ] Find a conversation partner or language exchange
- [ ] Plan an immersion trip as a goal/reward
- [ ] Start with basic conversational phrases
"#;

/// Template for Cabinet - GTD Principles Reference
pub const CABINET_GTD_PRINCIPLES_TEMPLATE: &str = r#"# GTD Principles Reference

## Reference

The Getting Things Done (GTD) methodology by David Allen - Core principles and practices.

## Key Points

- **Capture**: Collect what has your attention in trusted external systems
- **Clarify**: Process what it means and what to do about it
- **Organize**: Put it where it belongs based on what it is
- **Reflect**: Review frequently to stay current and aligned
- **Engage**: Use your trusted system to take action with confidence

## Notes

### The Five Steps of Mastering Workflow

1. **Capture** everything that has your attention
2. **Clarify** what each item means and what to do about it
3. **Organize** the results into trusted external systems
4. **Reflect** on your system regularly to keep it current
5. **Engage** with confidence in your moment-to-moment choices

### The Two-Minute Rule
If something takes less than two minutes to complete, do it now rather than adding it to your list.

### Weekly Review
- Get clear: Collect loose papers and materials, empty your head
- Get current: Review action lists, calendar, waiting-for lists
- Get creative: Review someday/maybe lists, trigger new ideas

### Natural Planning Model
1. Define purpose and principles
2. Envision the outcome
3. Brainstorm ideas
4. Organize into structure
5. Identify next actions
"#;

/// Generate a Morning Review habit template with current time
pub fn generate_morning_review_habit() -> String {
    let morning_time = Local::now()
        .with_hour(9)
        .unwrap()
        .with_minute(0)
        .unwrap()
        .with_second(0)
        .unwrap();
    
    format!(r#"# Morning Review
## Frequency
[!singleselect:habit-frequency:daily]
## Status
[!checkbox:habit-status:false]
## Focus Time
[!datetime:focus_date_time:{}]
## Notes
Review today's actions and priorities. Check calendar, update task statuses, and set focus for the day.
---
Created: {}"#, 
        morning_time.to_rfc3339(),
        Local::now().format("%Y-%m-%d")
    )
}

/// Generate an Evening Journal habit template with current time
pub fn generate_evening_journal_habit() -> String {
    let evening_time = Local::now()
        .with_hour(20)
        .unwrap()
        .with_minute(0)
        .unwrap()
        .with_second(0)
        .unwrap();
    
    format!(r#"# Evening Journal
## Frequency
[!singleselect:habit-frequency:daily]
## Status
[!checkbox:habit-status:false]
## Focus Time
[!datetime:focus_date_time:{}]
## Notes
Reflect on the day's accomplishments and lessons learned. Write down three things you're grateful for.
---
Created: {}"#,
        evening_time.to_rfc3339(),
        Local::now().format("%Y-%m-%d")
    )
}

/// Generate a Weekly Review habit template with next Sunday
pub fn generate_weekly_review_habit() -> String {
    // Find next Sunday at 2 PM
    let mut next_sunday = Local::now();
    while next_sunday.weekday() != Weekday::Sun {
        next_sunday = next_sunday + chrono::Duration::days(1);
    }
    next_sunday = next_sunday
        .with_hour(14)
        .unwrap()
        .with_minute(0)
        .unwrap()
        .with_second(0)
        .unwrap();
    
    format!(r#"# Weekly Review
## Frequency
[!singleselect:habit-frequency:weekly]
## Status
[!checkbox:habit-status:false]
## Focus Time
[!datetime:focus_date_time:{}]
## Notes
Complete weekly GTD review:
- Process all inboxes to zero
- Review project lists
- Update action lists
- Review Someday/Maybe items
- Clean up and organize
---
Created: {}"#,
        next_sunday.to_rfc3339(),
        Local::now().format("%Y-%m-%d")
    )
}

/// Template for project README.md file
pub fn generate_project_readme(name: &str, description: &str, due_date: Option<String>, status: &str) -> String {
    let due_date_str = due_date.as_deref().unwrap_or("Not set");
    format!(
        r#"# {}

## Description
{}

## Status
[!singleselect:project-status:{}]

## Due Date
[!datetime:due_date:{}]

## Created
[!datetime:created_date:{}]

## References
[!references:]

## Notes
<!-- Add any additional notes, context, or resources for this project here -->

## Actions
Actions for this project are stored as individual markdown files in this directory.
"#,
        name,
        description,
        status,
        if due_date_str != "Not set" { due_date_str } else { "" },
        Local::now().format("%Y-%m-%d")
    )
}

/// Template for action file
pub fn generate_action_template(name: &str, status: &str, focus_date: Option<String>, due_date: Option<String>, effort: &str) -> String {
    format!(
        r#"# {}

## Status
[!singleselect:status:{}]

## Focus Date
[!datetime:focus_date_time:{}]

## Due Date
[!datetime:due_date:{}]

## Effort
[!singleselect:effort:{}]

## References
[!references:]

## Notes
<!-- Add any additional notes or details about this action here -->

---
[!datetime:created_date_time:{}]
"#,
        name,
        status,
        focus_date.as_deref().unwrap_or(""),
        due_date.as_deref().unwrap_or(""),
        effort,
        Local::now().to_rfc3339()
    )
}

/// Template for a new habit file
pub fn generate_habit_template(name: &str, frequency: &str) -> String {
    let now = Local::now();
    format!(
        r#"# {}

## Status
[!checkbox:habit-status:false]

## Frequency
[!singleselect:habit-frequency:{}]

## Focus Time
[!datetime:focus_date_time:{}T09:00:00]

## Created
[!datetime:created_date:{}]

## History
| Date | Time | Status | Action | Notes |
|------|------|--------|--------|-------|
| {} | {} | To Do | Created | Initial habit creation |

"#,
        name,
        frequency,
        now.format("%Y-%m-%d"),
        now.format("%Y-%m-%d"),
        now.format("%Y-%m-%d"),
        now.format("%-I:%M %p")
    )
}