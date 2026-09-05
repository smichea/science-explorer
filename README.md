# Science Explorer

Science Explorer is a bilingual, immersive learning environment in which mathematics, physics, chemistry, and the history of science form one explorable knowledge universe.

The product is designed first for a learner entering the French **Terminale → MPSI → MP** path and preparing over three years for highly selective examinations such as **ENS** and **École polytechnique**. Its architecture must nevertheless support other ages, horizons, curricula, and learners.

## Product idea

The learner does not follow a fixed list of chapters. They enter a stable 3D atlas of scientific knowledge, choose destinations, take part in historical scientific missions, build mathematical tools, and apply those tools to physical and chemical phenomena.

The same knowledge universe is visible from the first session. A learner profile changes the highlighted horizon, recommended depth, and available missions, but it does not replace the universe with a separate map or enforce hard locks.

## Core principles

- **One universe, several views:** concepts, applications, history, prerequisites, and progress are layers over the same map.
- **Mathematics is the toolbox:** mathematical ideas are constructed and then reused to model phenomena in physics and chemistry.
- **Every activity is a scenario:** each mission takes place at a specific location and time and involves one or more scientists of that period.
- **Free but guided exploration:** learners may go deeper, return to foundations, or branch into another domain.
- **Evidence-based progression:** the virtual backpack shows both mastery and the percentage of relevant phenomena in which each tool has actually been applied.
- **Bilingual by design:** the complete learner experience and authored content are available in French and English.
- **Local-first:** name and age are stored locally; detailed progress is kept on the device and can be exported.

## Reference learner

The initial reference profile is:

```yaml
name: Paul
age: 17
current_stage: terminale
horizon:
  - terminale
  - mpsi
  - mp
targets:
  - ENS
  - Ecole_polytechnique
language_options:
  - fr
  - en
```

Age selects a default learning horizon, not an absolute permission boundary. Paul may inspect or attempt an MP destination immediately; the application should expose the useful prerequisite routes rather than display a closed lock.

## Specifications

- [Product and UX specification](docs/PRODUCT_SPECIFICATION.md)
- [Knowledge, content, and learning model](docs/LEARNING_AND_CONTENT_MODEL.md)
- [Technical architecture](docs/TECHNICAL_ARCHITECTURE.md)

## Initial implementation target

The first useful release is a complete vertical slice rather than a large but shallow map:

1. bilingual local onboarding;
2. a small 3D universe containing the three worlds;
3. one mathematical tool;
4. three linked physical or chemical phenomena;
5. one complete historical mission;
6. a reusable simulation;
7. exercises and evidence collection;
8. a working virtual backpack;
9. learner and guide views;
10. local persistence and progress export.

The specifications in this repository are the source of truth for the first implementation.
