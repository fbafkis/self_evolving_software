# Autonomous Software Prototype

This is a prototype of a software that evolves autonomously by using ChatGPT to add components and expand its functionalities. The software is designed to evaluate its own capabilities and enhance itself over time.

## Overview

The software can respond to natural language queries and dynamically generate or modify its own codebase to meet the user's requests. By interacting with ChatGPT, it can develop new plugins, manage dependencies, and execute various tasks. This makes it a self-improving and self-evaluating system.

## Example Requests

Here are some example requests you can use to test the capabilities of this software:

- **Multiplication:**
  - "Can you solve the multiplication 5342214 * 34356677?"
  
- **Sunset Time:**
  - "At what time did the sun go down on 12th July 2024 in Sofia, Bulgaria?"
  - "Can you tell me the sunset time on the day 14th August 2024 in Bergamo, Italy?"

- **Exponential Calculation:**
  - "What is the result of 14597825423 ^ 2?"

- **Weather Information:**
  - "What was the weather on 23rd of July 2024 at 14:30 in Lisbon, Portugal?"

- **Stock Value:**
  - "Can you tell me what was the value of the Google stock on 10th of June 2024?"
  - "I need to know the stock value mean of Apple on yesterday, 21st of August 2024."

- **Complex Multiplications:**
  - "I need you to solve this mathematical operation: 457722555666441 * 258944541153761380555."
  - "What is the sum of 3492048 + 34981200?"

- **Fibonacci Sequence:**
  - "What is the mean of the first 143 numbers that belong to the Fibonacci sequence?"

- **Vector Multiplication:**
  - "I need to resolve the multiplication of these two vectors [2,4,8,14] and [6,6,1,24]."

## How It Works

When you enter a request, the software evaluates whether it can fulfill it using existing capabilities and plugins. If it cannot, it generates new plugins or modifies existing ones by interacting with ChatGPT, allowing it to continuously improve and adapt to more complex tasks over time.

## Getting Started

To start using the software, simply run the application specifying the option  and enter one of the example requests or your own query. The software will handle the rest, attempting to generate the necessary code to provide an answer to your query.

### Logging Options

You can control the level of detail in the logging output by using the `--log-level` option when running the application:

- **`--log-level=info`:** This is the default log level. It will display general information about the program's operations, including key actions and outcomes.
  
- **`--log-level=debug`:** This will display detailed debug information, including more granular details of the program's execution, which is useful for troubleshooting and development.

## Future Development

As this is a prototype, future iterations will focus on enhancing the software's ability to evaluate and modify its own functionality, allowing it to become even more autonomous and versatile.
