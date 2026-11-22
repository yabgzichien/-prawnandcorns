# XMUM Student Companion

**A student-controlled dashboard and AI assistant for navigating university life.**

Built for the XMUM AI Agent Innovation Competition 2026. The project is currently in the planning stage.

---

## The idea

New students have to keep track of classes, assignments, meetings and other responsibilities across different places. XMUM Student Companion aims to bring the information they need into one dashboard and help them decide what to do next.

The AI acts as a personal assistant: it gathers relevant information, suggests priorities and plans, and helps carry out confirmed actions. Students remain in control of their schedules and decisions.

## First MVP

The first prototype focuses on one complete workflow using **fictional data**:

1. View a timetable, tasks and deadlines on the dashboard.
2. Ask the assistant to plan the week or suggest priorities.
3. Let the assistant retrieve relevant information and propose a plan.
4. Check time conflicts and deadlines through application logic.
5. Review, edit or reject the plan.
6. Confirm the plan and see it saved on the dashboard, including after a refresh.

> Example: “What should I focus on this week? I have a meeting on Wednesday evening.”

Ideas for later include campus maps, clubs and activities, finance guidance, and email drafting. These are possibilities, not committed MVP features.

## Planned technology

| Area | Technology | Purpose |
| --- | --- | --- |
| Web application | Next.js | Dashboard, user interactions and server-side logic |
| Deployment | Vercel | Host the application |
| Database | Neon | Store application data and confirmed plans |
| AI | To be decided | Interpret requests and use application tools to help plan and act |

The AI can propose a schedule, while application logic checks constraints such as conflicts and deadlines. The student confirms a plan before it is saved.

## Team

| Members | Responsibility |
| --- | --- |
| David and Jinquan | Technical development |
| fyy and JianXuan | UI/UX design |
| Keevan KK and Khoo Li Ling | Pitching and documentation |

The team will agree on detailed tasks and interfaces together as the project develops.

## Data and integrations

- Use **fictional student, timetable and assignment data** in the competition prototype.
- Moodle, Academic Affairs and other XMUM integrations are ideas to investigate, not implemented features. Do not assume access is available or permitted.
- Confirm the competition rules and obtain any necessary authorization before accessing non-public systems or data.
- Do not ask students to enter their Campus ID passwords into the application.
- Keep AI API keys and database credentials on the server and out of version control.

## Competition

| Item | Requirement |
| --- | --- |
| Submission deadline | **16 December 2026** |
| Required | English presentation slides and a functional AI agent or MVP |
| Optional | Written project proposal in Word |

Verify the latest requirements with the organizers before submitting. The competition handbook also describes restrictions on personal, non-public and confidential information.

---

**Status:** Planning. The features and architecture above are proposed and have not yet been implemented. Setup and deployment instructions will be added when the application is created.
