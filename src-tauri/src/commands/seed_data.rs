//! Seed data and templates for GTD Space initialization
//!
//! This module contains all the template content and seed data used when
//! initializing a new GTD Space or seeding example content.

use chrono::{Datelike, Local, Timelike, Weekday};

/// Template for Areas of Focus overview page
pub const AREAS_OF_FOCUS_OVERVIEW_TEMPLATE: &str = r#"# Areas of Focus (20,000 ft)

**Important spheres of work and life to maintain at standards**

These are your ongoing responsibilities—the roles you play and standards you maintain. Unlike projects (which complete), these require continuous attention.

## Weekly Review Questions
- What areas need attention this week?
- Are my current projects supporting the right areas?
- What's falling through the cracks?

*Each area has its own page. Click to view projects and standards.*
"#;

/// Template for individual Area of Focus pages with references
pub fn generate_area_of_focus_template_with_refs(
    name: &str,
    description: &str,
    standards: &str,
    goals_refs: &str,
    vision_refs: &str,
    purpose_refs: &str,
) -> String {
    format!(
        r#"# {}

{}

{}

## Horizon Alignment
[!goals-references:{}]

[!vision-references:{}]

[!purpose-references:{}]

## Active Projects
[!projects-list]

## References
[!references:]
"#,
        name, description, standards, goals_refs, vision_refs, purpose_refs
    )
}

/// Template for Goals overview page
pub const GOALS_OVERVIEW_TEMPLATE: &str = r#"# Goals (30,000 ft)

**What you want to achieve in the next 1-2 years**

These accomplishments will require multiple projects to complete. They provide focus and direction for your efforts.

## Quarterly Review
- What progress have I made?
- What needs to shift?
- Are these still the right goals?

*Each goal has its own page with milestones and projects.*
"#;

/// Template for individual Goal pages with references
pub fn generate_goal_template_with_refs(
    name: &str,
    target_date: Option<&str>,
    outcome: &str,
    vision_refs: &str,
    purpose_refs: &str,
) -> String {
    let target_section = if let Some(date) = target_date {
        format!("**Target:** [!datetime:due_date:{}]\n\n", date)
    } else {
        String::new()
    };
    
    format!(
        r#"# {}

{}## Successful Outcome
{}

## Aligned With
[!vision-references:{}]

[!purpose-references:{}]

## Related Items
[!projects-areas-list]

## References
[!references:]
"#,
        name, target_section, outcome, vision_refs, purpose_refs
    )
}

/// Template for Vision folder
pub const VISION_OVERVIEW_TEMPLATE: &str = r#"# Vision (40,000 ft)

**What wild success looks like in 3-5 years**

This is your ideal scenario—vivid, inspiring, and achievable. It guides your goals and major decisions.

## Annual Review
Revisit each year to recalibrate based on progress and life changes.
"#;

/// Template for main Vision document with references
pub fn generate_vision_document_template_with_refs(purpose_refs: &str) -> String {
    format!(
        r#"# 3-5 Year Vision

**Living My Purpose**
[!purpose-references:{}]

## The Picture of Success

*It's 3-5 years from now. I wake up and...*

### Professional Life
I'm [role/position] making impact by [key contribution]. My work involves [core activities] and I'm recognized for [unique value].

### Personal Life
I live in [location/environment]. My days include [key activities]. I spend quality time [relationships/activities].

### Health & Energy
I maintain [fitness level] through [practices]. My energy is [description] because I [habits/routines].

### Financial Freedom
I have [financial state] allowing me to [possibilities]. My income comes from [sources].

### Growth & Learning
I've mastered [skills/knowledge]. I'm exploring [new areas]. I contribute by [teaching/sharing].

## Supporting Elements
[!goals-areas-list]

## References
[!references:]
"#,
        purpose_refs
    )
}

/// Template for Purpose & Principles folder
pub const PURPOSE_PRINCIPLES_OVERVIEW_TEMPLATE: &str = r#"# Purpose & Principles (50,000 ft)

**Why you exist and what you stand for**

Your ultimate intention and core standards. These drive everything else.

## When to Review
- Major life decisions
- Annual deep reflection
- When feeling lost or unmotivated
"#;

/// Template for Life Mission document
pub const LIFE_MISSION_TEMPLATE: &str = r#"# Life Mission

## My Purpose Statement

*I exist to [core purpose] by [primary means] so that [ultimate impact].*

## This Means I:

**Create**: [What I bring into existence]

**Serve**: [Who I help and how]

**Learn**: [What I explore and master]

**Share**: [What I teach and give]

## Living This Purpose
- In my work, I...
- In relationships, I...
- In community, I...
- For myself, I...

## Supported By
[!visions-goals-list]

## References
[!references:]
"#;

/// Template for Core Values document
pub const CORE_VALUES_TEMPLATE: &str = r#"# Core Values & Principles

## My Top 5 Values

1. **Integrity** - Being true to my word and values
2. **Growth** - Continuously learning and improving
3. **Connection** - Building meaningful relationships
4. **Excellence** - Doing my best work
5. **[Your Value]** - [What it means]

## Operating Principles

✓ **I always**: Take responsibility for my commitments

✓ **I never**: Compromise my integrity for short-term gain

✓ **I believe**: Everyone has something valuable to teach

✓ **I stand for**: Making a positive difference

## Expressed Through
[!visions-goals-list]

## Decision Filter

Before major decisions, I ask:
1. Does this align with my values?
2. Will I be proud of this choice?  
3. Does this move me toward my vision?

## References
[!references:]
"#;

/// Template content for the Welcome to GTD Space file
pub const WELCOME_TEMPLATE: &str = r#"# Welcome to Your GTD Space

Your complete Getting Things Done system is ready. Everything is organized by horizons of focus:

## Quick Start

1. **Review** the example projects and horizons to see how GTD works
2. **Create** your first real project with a clear outcome
3. **Add** concrete next actions (they appear instantly in the sidebar)
4. **Set** focus dates for when you'll work on things
5. **Track** progress with interactive status fields

## Your GTD Structure

**Horizons** (50,000 ft → Ground level)
- **Purpose & Principles** - Your core values and life mission
- **Vision** - 3-5 year aspirational outcomes
- **Goals** - 1-2 year objectives with milestones
- **Areas of Focus** - Ongoing responsibilities to maintain

**Execution**
- **Projects** - Multi-step outcomes (folders with actions inside)
- **Actions** - Concrete next steps with status, effort, and dates
- **Habits** - Recurring routines that auto-reset
- **Calendar** - All your dated items in one view

**Support**
- **Someday Maybe** - Ideas for future consideration
- **Cabinet** - Reference materials (no action required)

## Keyboard Shortcuts

- `Cmd/Ctrl+Alt+S` - Insert Status field
- `Cmd/Ctrl+Alt+D` - Insert Due Date
- `Cmd/Ctrl+Alt+T` - Insert Focus Date/Time
- `Cmd/Ctrl+Alt+R` - Insert References

## Weekly Review

Every week, process everything:
1. Collect loose items
2. Review all projects
3. Update action statuses
4. Check calendar and horizons
5. Identify next actions

Start exploring your seeded examples to see GTD in action!
"#;

/// Template for Someday Maybe - Learn a New Language
pub const SOMEDAY_LEARN_LANGUAGE_TEMPLATE: &str = r#"# Learn Spanish

**Why**: Connect with 500M+ speakers, enhance travel, cognitive benefits

**Success looks like**: Conversational fluency within 1 year

## When I'm ready:
- [ ] Choose learning method (app/tutor/class)
- [ ] Commit to 30 min daily practice
- [ ] Find conversation partner
- [ ] Plan immersion trip to Spain/Latin America
- [ ] Join local Spanish conversation group

## Resources to explore:
- Language learning apps comparison
- Local community college courses
- Online tutoring platforms
- Spanish media for immersion

*Move to Projects when ready to commit*
"#;

/// Template for Cabinet - GTD Principles Reference
pub const CABINET_GTD_PRINCIPLES_TEMPLATE: &str = r#"# GTD Quick Reference

## The Five Steps
1. **Capture** - Get it out of your head
2. **Clarify** - Decide what it means and what to do
3. **Organize** - Put it where it belongs
4. **Reflect** - Review to stay current
5. **Engage** - Trust your system and do

## Processing Questions
- What is it?
- Is it actionable?
- What's the next action?
- Will it take less than 2 minutes? → Do it now
- Am I the right person? → Delegate it
- Is there a deadline? → Calendar it
- Multiple steps? → Make it a project

## Weekly Review Checklist
□ Process all inboxes to zero
□ Review project list
□ Review next actions
□ Review waiting-for list
□ Review calendar (past & future)
□ Review Someday/Maybe
□ Get creative - any new projects?

## Horizons of Focus
- **50,000 ft**: Purpose & Principles
- **40,000 ft**: Vision (3-5 years)
- **30,000 ft**: Goals (1-2 years)
- **20,000 ft**: Areas of Focus
- **10,000 ft**: Projects
- **Runway**: Next Actions

## Natural Planning
1. Why? (Purpose)
2. What would success look like? (Vision)
3. How might we do this? (Brainstorm)
4. What's the plan? (Organize)
5. What's the next action? (Next step)
"#;

/// Generate a Weekly Review habit template with next Sunday
pub fn generate_weekly_review_habit() -> String {
    let now = Local::now();
    // Find next Sunday at 2 PM
    let mut next_sunday = now;
    while next_sunday.weekday() != Weekday::Sun {
        next_sunday += chrono::Duration::days(1);
    }
    next_sunday = next_sunday
        .with_hour(14)
        .unwrap()
        .with_minute(0)
        .unwrap()
        .with_second(0)
        .unwrap();

    // If we're already past Sunday 2pm, advance to next Sunday
    if next_sunday <= now {
        next_sunday += chrono::Duration::days(7);
    }

    format!(
        r#"# Weekly Review
## Frequency
[!singleselect:habit-frequency:weekly]
## Status
[!checkbox:habit-status:false]
## Focus Date
[!datetime:focus_date:{}]
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
        now.to_rfc3339()
    )
}

/// Template for project README.md file
pub fn generate_project_readme(
    name: &str,
    description: &str,
    due_date: Option<String>,
    status: &str,
) -> String {
    generate_project_readme_with_refs(name, description, due_date, status, "", "", "")
}

/// Template for project README.md file with references
pub fn generate_project_readme_with_refs(
    name: &str,
    description: &str,
    due_date: Option<String>,
    status: &str,
    areas_refs: &str,
    goals_refs: &str,
    general_refs: &str,
) -> String {
    let due_date_str = due_date.as_deref().unwrap_or("Not set");
    format!(
        r#"# {}

## Desired Outcome
{}

## Status
[!singleselect:project-status:{}]
{}
## Created
[!datetime:created_date_time:{}]

## Horizon References
[!areas-references:{}]

[!goals-references:{}]

## Actions
Actions for this project are stored as individual markdown files in this directory.

## Notes
<!-- Add any additional notes, context, or resources for this project here -->

## References
[!references:{}]
"#,
        name,
        description,
        status,
        if due_date_str != "Not set" {
            format!("\n## Due Date\n[!datetime:due_date:{}]\n", due_date_str)
        } else {
            String::from("")
        },
        Local::now().to_rfc3339(),
        areas_refs,
        goals_refs,
        general_refs
    )
}

/// Template for action file
pub fn generate_action_template(
    name: &str,
    status: &str,
    focus_date: Option<String>,
    due_date: Option<String>,
    effort: &str,
) -> String {
    let mut template = format!(
        r#"# {}

## Status
[!singleselect:status:{}]
"#,
        name,
        status
    );

    // Only add focus date section if provided
    if let Some(date) = focus_date {
        template.push_str(&format!(
            r#"
## Focus Date
[!datetime:focus_date:{}]
"#,
            date
        ));
    }

    // Only add due date section if provided
    if let Some(date) = due_date {
        template.push_str(&format!(
            r#"
## Due Date
[!datetime:due_date:{}]
"#,
            date
        ));
    }

    template.push_str(&format!(
        r#"
## Effort
[!singleselect:effort:{}]

## References
[!references:]

## Notes
<!-- Add any additional notes or details about this action here -->

---
## Created
[!datetime:created_date_time:{}]
"#,
        effort,
        Local::now().to_rfc3339()
    ));

    template
}
