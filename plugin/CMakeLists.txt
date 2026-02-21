cmake_minimum_required(VERSION 3.22)
project(open_sample_manager_plugin VERSION 0.1.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

if(DEFINED JUCE_SOURCE_DIR)
  message(STATUS "Using JUCE from ${JUCE_SOURCE_DIR}")
  add_subdirectory(${JUCE_SOURCE_DIR} JUCE)
  add_custom_target(open_sample_manager_plugin
    COMMAND ${CMAKE_COMMAND} -E echo "JUCE detected. Add plugin sources in plugin/Source to build AU targets."
  )
else()
  message(WARNING "JUCE_SOURCE_DIR is not set. Configure it when you start plugin implementation.")
  add_custom_target(open_sample_manager_plugin_stub
    COMMAND ${CMAKE_COMMAND} -E echo "Set JUCE_SOURCE_DIR to your JUCE checkout, then reconfigure."
  )
endif()
