# MAGTORQ Standard Gearbox Selector - Project Documentation

This document provides a comprehensive overview of the **MAGTORQ Standard Gearbox Selector** application, detailing its architecture, database, selection rules, and the mathematical formulas used in all calculations.

---

## 1. System Overview

The **MAGTORQ Standard Gearbox Selector** is an interactive, single-page web utility designed for mechanical engineers to select the optimal combination of multi-stage gearboxes for a given set of operating requirements. 

### Key Capabilities:
- **Multi-Stage Combinations**: Supports configurations from 1 to 4 reduction stages.
- **Ratio Matching**: Evaluates thousands of potential gear ratio combinations from standardized series to find those with the lowest deviation from the target ratio.
- **Torque Calculation**: Computes nominal and peak (maximum) output torques based on power, speed, and service factors.
- **Efficiency Modelling**: Accounts for a 3% transmission loss ($97\%$ efficiency) at each gear stage.
- **Automated Gearbox Selection**: Automatically maps calculated stage torque requirements to standard MAGTORQ product lines (L, M, H, and numerical series).
- **Safety Evaluation**: Calculates safety margins for each stage and warns if requirements exceed standard gearbox limits.

---

## 2. Core Mathematical Formulas

The application performs calculations at two levels: **System level** (overall output) and **Stage level** (individual stage parameters).

### 2.1. Velocity (Speed) Calculations
The rotational speed is reduced at each stage relative to the stage's gear ratio:

$$N_{\text{out}} = \frac{N_{\text{in}}}{T_{\text{ratio}}}$$

Where:
- $N_{\text{in}}$ = Input Speed ($\text{RPM}$)
- $N_{\text{out}}$ = Output Speed ($\text{RPM}$)
- $T_{\text{ratio}}$ = Total or Stage Gear Ratio

At any specific stage $i$:
$$N_{\text{out}, i} = \frac{N_{\text{in}, i}}{r_i}$$
*(where $N_{\text{in}, i} = N_{\text{out}, i-1}$ and $r_i$ is the gear ratio of stage $i$)*

---

### 2.2. Gearbox Efficiency
Every stage introduces a mechanical friction loss, modelled at **$3\%$ per stage** (or **$97\%$ efficiency**).
For a system with $k$ stages, the cumulative mechanical efficiency $\eta$ is:

$$\eta = 0.97^k$$

For example:
- **1 Stage**: $\eta = 0.97^1 = 0.97$ ($97\%$)
- **2 Stages**: $\eta = 0.97^2 = 0.9409$ ($94.09\%$)
- **3 Stages**: $\eta = 0.97^3 = 0.9127$ ($91.27\%$)
- **4 Stages**: $\eta = 0.97^4 = 0.8853$ ($88.53\%$)

---

### 2.3. Output Torque Calculations
The mechanical torque $T$ (in $\text{N}\cdot\text{m}$) is derived from power $P$ (in $\text{kW}$) and rotational speed $N$ (in $\text{RPM}$).

#### Derivation:
Power is defined as:
$$P_{\text{watts}} = T \times \omega$$

Where angular velocity $\omega$ in radians per second is:
$$\omega = \frac{2\pi \times N}{60}$$

Substituting $\omega$ and converting Power from $\text{kW}$ to Watts ($P_{\text{watts}} = P_{\text{kW}} \times 1000$):
$$P_{\text{kW}} \times 1000 = T \times \frac{2\pi \times N}{60}$$

Solving for Torque $T$:
$$T = \frac{P_{\text{kW}} \times 1000 \times 60}{2\pi \times N} = \frac{P_{\text{kW}} \times 60,000}{2\pi \times N}$$

#### System Nominal Output Torque ($T_{\text{nominal}}$)
By substituting $N_{\text{out}} = \frac{N_{\text{in}}}{T_{\text{ratio}}}$ and applying the cumulative efficiency $\eta$:

$$T_{\text{nominal}} = \frac{P \times 60,000 \times T_{\text{ratio}} \times 0.97^k}{2\pi \times N_{\text{in}}}$$

Where:
- $P$ = Input Power ($\text{kW}$)
- $T_{\text{ratio}}$ = Combined Gear Ratio
- $N_{\text{in}}$ = Input Speed ($\text{RPM}$)
- $k$ = Total number of stages

#### System Max Output Torque ($T_{\text{max}}$)
Peak torque is the nominal torque scaled by the service factor ($SF$):

$$T_{\text{max}} = T_{\text{nominal}} \times SF$$

---

### 2.4. Ratio Deviation
The deviation of the calculated combined ratio from the user's requested target ratio is calculated as:

$$\text{Deviation \%} = \left( \frac{T_{\text{ratio}} - R_{\text{target}}}{R_{\text{target}}} \right) \times 100$$

Where:
- $T_{\text{ratio}}$ = Product of chosen stage ratios ($\prod_{i=1}^k r_i$)
- $R_{\text{target}}$ = Target Ratio requested by the user

---

### 2.5. Safety Factor (SF) Evaluation
For each stage, the program selects a gearbox and evaluates its safety factor. It compares the selected gearbox's limits with the stage's actual torque requirements.

$$\text{Safety Factor} = \min \left( \frac{\text{Gearbox Nominal Torque Capacity}}{\text{Stage Nominal Torque}}, \frac{\text{Gearbox Rated Torque Capacity}}{\text{Stage Max Torque}} \right)$$

- If $\text{Safety Factor} \ge 1.0$: The selection is safe ($\color{#238636}{\text{✓ OK}}$).
- If $\text{Safety Factor} < 1.0$: The torque exceeds the gearbox's capacity ($\color{#ff4500}{\text{⚠ Exceeds}}$).

---

## 3. Database Structure

The project embeds standard data lists for ratio series and gearbox capacities.

### 3.1. Standard Gear Ratio Series (`seriesData`)
Different stage series have standardized lists of available ratios:

| Series ID | Available Ratios |
| :--- | :--- |
| **S1** | 3.75, 4.25, 4.5, 4.71, 5.05, 5.67, 5.71, 6.25, 6.68, 7.2, 7.58, 7.8, 8.04, 8.65, 8.74, 9.43, 10.125, 10.26 |
| **S2** | 4.71, 5.82, 6.19, 7.2, 7.58 |
| **S3** | 4.76, 5.06 |
| **S4** | 4.0, 4.24, 4.5 |

### 3.2. Gearbox Database (`gearboxes`)
The program selects gearboxes from four standard categories depending on the series and stage ratio.

#### Category Capacity Boundaries (Excerpts):
- **Series 1 (Light - L Series)**: Nominal torque capacities range from **$84\text{ N}\cdot\text{m}$ (L065)** to **$27,576\text{ N}\cdot\text{m}$ (L480)**.
- **Series 1 (Medium - M Series)**: Nominal torque capacities range from **$150\text{ N}\cdot\text{m}$ (M100)** to **$44,498\text{ N}\cdot\text{m}$ (M750)**.
- **Series 1 (Heavy - H Series)**: Nominal torque capacities range from **$170\text{ N}\cdot\text{m}$ (H140)** to **$52,853\text{ N}\cdot\text{m}$ (H940)**.
- **Series 2, 3, & 4**: Standard industrial sizes (e.g. `2110-10`, `3125-10`, `4095-10`) with torque capacities scaling up to **$700,000\text{ N}\cdot\text{m}$**.

---

## 4. Decision and Selection Logic

### 4.1. Stage-Ratio Restriction (First Stage only)
To optimize performance, the selector applies special rules to restrict the first stage if **S1** series is used:
- If Stage 1 ratio $r_1 \in [3.75, 5.05]$, only **L**-series gearboxes are considered.
- If Stage 1 ratio $r_1 \in [5.67, 7.6]$, only **M**-series gearboxes are considered.
- If Stage 1 ratio $r_1 \in [8.04, 10.26]$, only **H**-series gearboxes are considered.

### 4.2. Capacity Matching Logic
For a required nominal torque ($T_{\text{req\_nom}}$) and maximum torque ($T_{\text{req\_max}}$):
1. **Rule 1**: Find gearboxes within the series where:
   $$\text{Gearbox Nominal} \ge T_{\text{req\_nom}} \quad \text{AND} \quad \text{Gearbox Rated} \ge T_{\text{req\_max}}$$
   Sort matches by nominal capacity ascending and return the smallest one.
2. **Rule 2**: If no gearbox meets both, fall back to:
   $$\text{Gearbox Rated} \ge T_{\text{req\_max}}$$
   Sort matches by rated capacity ascending and return the smallest.
3. **Rule 3**: If none found, return the gearbox with the absolute largest capacity in the series.

---

## 5. Step-by-Step Calculation Walkthrough

Let us calculate a sample scenario manually to illustrate the algorithm:

### Input Parameters:
- **Project**: Test Project
- **Target Ratio ($R_{\text{target}}$)**: 50.0
- **No. of Stages ($k$)**: 2
- **Stage 1 Series**: S1
- **Stage 2 Series**: S2
- **Power ($P$)**: 15 kW
- **Input Speed ($N_{\text{in}}$)**: 1440 RPM
- **Service Factor ($SF$)**: 1.5

---

### Step 5.1: Ratio Combinations & Selection
The program generates combinations from S1 ($19$ choices) and S2 ($5$ choices), producing $19 \times 5 = 95$ total combinations.
Let us examine one candidate combination:
- **Stage 1 Ratio ($r_1$)** = 8.65 (Series S1)
- **Stage 2 Ratio ($r_2$)** = 5.82 (Series S2)

#### Total System Ratio:
$$T_{\text{ratio}} = 8.65 \times 5.82 = 50.343$$

#### Ratio Deviation:
$$\text{Deviation} = \left(\frac{50.343 - 50.0}{50.0}\right) \times 100 = +0.686\%$$
*(This is within the acceptable $\pm 3\%$ limit).*

---

### Step 5.2: Stage-by-Stage Calculations

#### **STAGE 1:**
- **Input Speed ($N_{\text{in}, 1}$)** = $1440\text{ RPM}$
- **Input Torque ($T_{\text{in}, 1}$)**:
  $$T_{\text{in}, 1} = \frac{15 \times 60,000}{2\pi \times 1440} = 99.47\text{ N}\cdot\text{m}$$
- **Stage 1 Output Speed ($N_{\text{out}, 1}$)**:
  $$N_{\text{out}, 1} = \frac{1440}{8.65} \approx 166.47\text{ RPM}$$
- **Stage 1 Output Torque ($T_{\text{nominal}, 1}$)** accounting for $97\%$ efficiency:
  $$T_{\text{nominal}, 1} = T_{\text{in}, 1} \times r_1 \times 0.97 = 99.47 \times 8.65 \times 0.97 = 834.6\text{ N}\cdot\text{m}$$
- **Stage 1 Max Output Torque ($T_{\text{max}, 1}$)**:
  $$T_{\text{max}, 1} = T_{\text{nominal}, 1} \times SF = 834.6 \times 1.5 = 1251.9\text{ N}\cdot\text{m}$$

##### Gearbox Selection for Stage 1:
- Since Stage 1 is series **S1** and the ratio is $8.65$ (which lies in the $[8.04, 10.26]$ range), the system restricts selection to **H (Heavy) series** gearboxes.
- We require $\text{Nominal} \ge 834.6\text{ N}\cdot\text{m}$ and $\text{Rated} \ge 1251.9\text{ N}\cdot\text{m}$.
- Looking at the database:
  - `H200` has nominal 490 (too small)
  - `H240` has nominal 913, rated 913 (rated too small for 1251.9)
  - `H285` has nominal 1400, rated 1400 (meets both conditions)
- **Selected Gearbox**: **`H285`**
- **Safety Factor Calculation**:
  $$\text{Safety (Nominal)} = \frac{1400}{834.6} = 1.68$$
  $$\text{Safety (Rated)} = \frac{1400}{1251.9} = 1.12$$
  $$\text{Safety Factor} = \min(1.68, 1.12) = 1.12 \quad (\color{#238636}{\text{✓ OK}})$$

---

#### **STAGE 2:**
- **Input Speed ($N_{\text{in}, 2}$)** = $166.47\text{ RPM}$
- **Input Torque ($T_{\text{in}, 2}$)** = $834.6\text{ N}\cdot\text{m}$
- **Stage 2 Output Speed ($N_{\text{out}, 2}$)**:
  $$N_{\text{out}, 2} = \frac{166.47}{5.82} \approx 28.60\text{ RPM}$$
- **Stage 2 Output Torque ($T_{\text{nominal}, 2}$)** accounting for $97\%$ efficiency:
  $$T_{\text{nominal}, 2} = T_{\text{in}, 2} \times r_2 \times 0.97 = 834.6 \times 5.82 \times 0.97 = 4711.6\text{ N}\cdot\text{m}$$
- **Stage 2 Max Output Torque ($T_{\text{max}, 2}$)**:
  $$T_{\text{max}, 2} = T_{\text{nominal}, 2} \times SF = 4711.6 \times 1.5 = 7067.4\text{ N}\cdot\text{m}$$

##### Gearbox Selection for Stage 2:
- Stage 2 is series **S2**. Gearboxes of Series 2 are matching numerical codes (e.g. `2250-12`).
- We require $\text{Nominal} \ge 4711.6\text{ N}\cdot\text{m}$ and $\text{Rated} \ge 7067.4\text{ N}\cdot\text{m}$.
- Looking at Series 2 database:
  - `2250-12`: Nominal = 4600, Rated = 5500 (too small)
  - `2270-10`: Nominal = 5017, Rated = 5880 (rated 5880 is too small for 7067.4)
  - `2270-12`: Nominal = 6087, Rated = 7133 (meets both conditions)
- **Selected Gearbox**: **`2270-12`**
- **Safety Factor Calculation**:
  $$\text{Safety (Nominal)} = \frac{6087}{4711.6} = 1.29$$
  $$\text{Safety (Rated)} = \frac{7133}{7067.4} = 1.01$$
  $$\text{Safety Factor} = \min(1.29, 1.01) = 1.01 \quad (\color{#238636}{\text{✓ OK}})$$
