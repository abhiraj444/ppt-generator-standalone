'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useTheme } from '@/context/ThemeContext';
import {
  Type,
  List,
  ListOrdered,
  FileText,
  Info,
  Table as TableIcon,
  Lightbulb,
  Target,
  TrendingUp,
  Users,
  Heart,
  Brain,
  Stethoscope
} from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { Slide, ContentItem } from '@/types';

// Theme-aware gradient system for slides
const lightModeGradients = [
  'from-gray-900 via-gray-800 to-gray-700',            // Clean and neutral
  'from-blue-950 via-indigo-900 to-purple-900',        // Deep cool tones
  'from-teal-900 via-emerald-800 to-green-800',        // Muted green tones
  'from-rose-900 via-pink-900 to-fuchsia-900',         // Elegant warm tones
  'from-yellow-800 via-orange-900 to-amber-900',       // Warm with a hint of richness
  'from-slate-900 via-slate-800 to-slate-700',         // Polished dark slate
  'from-cyan-900 via-blue-900 to-sky-900',             // Deep ocean feel
  'from-zinc-900 via-zinc-800 to-zinc-700'             // Very neutral, good for content-heavy areas
];

const darkModeGradients = [
  'from-gray-900 via-gray-800 to-gray-700',            // Clean and neutral
  'from-blue-950 via-indigo-900 to-purple-900',        // Deep cool tones
  'from-teal-900 via-emerald-800 to-green-800',        // Muted green tones
  'from-rose-900 via-pink-900 to-fuchsia-900',         // Elegant warm tones
  'from-yellow-800 via-orange-900 to-amber-900',       // Warm with a hint of richness
  'from-slate-900 via-slate-800 to-slate-700',         // Polished dark slate
  'from-cyan-900 via-blue-900 to-sky-900',             // Deep ocean feel
  'from-zinc-900 via-zinc-800 to-zinc-700'             // Neutral dark for maximum readability
];

// Medical-themed accent colors for content sections
const contentAccents = {
  paragraph: 'text-blue-100 bg-blue-500/20',
  bullet_list: 'text-emerald-100 bg-emerald-500/20',
  numbered_list: 'text-purple-100 bg-purple-500/20',
  table: 'text-orange-100 bg-orange-500/20',
  note: 'text-amber-100 bg-amber-500/20'
};

// Medical icons for different content types
const medicalIcons = {
  paragraph: Stethoscope,
  bullet_list: Heart,
  numbered_list: Brain,
  table: Users,
  note: Lightbulb
};

interface BoldRendererProps {
  text: string;
  bold?: string[];
  className?: string;
}

const BoldRenderer: React.FC<BoldRendererProps> = ({ text, bold = [], className = "" }) => {
  if (!text) return null;
  if (bold.length === 0) {
    return <span className={className}>{text}</span>;
  }

  const boldEscaped = bold.map(b => b.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'));
  const regex = new RegExp(`(${boldEscaped.join('|')})`, 'g');
  const parts = text.split(regex).filter(Boolean);

  return (
    <span className={`${className} text-wrap mobile-text-wrap`}>
      {parts.map((part, i) =>
        bold.includes(part) ?
          <strong key={i} className="font-bold text-white drop-shadow-sm">{part}</strong> :
          part
      )}
    </span>
  );
};

interface ContentItemRendererProps {
  item: ContentItem;
  index: number;
  slideIndex: number;
}

const ContentItemRenderer: React.FC<ContentItemRendererProps> = ({ item, index, slideIndex }) => {
  const IconComponent = medicalIcons[item.type as keyof typeof medicalIcons] || FileText;
  const accentClass = contentAccents[item.type as keyof typeof contentAccents] || contentAccents.paragraph;

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        delay: index * 0.1,
        duration: 0.5,
        ease: "easeOut"
      }
    }
  };

  return (
    <motion.div
      variants={itemVariants}
      initial="hidden"
      animate="visible"
      className="group relative w-full max-w-full"
    >
      <div className="relative overflow-hidden rounded-lg sm:rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 hover:bg-white/15 transition-all duration-300 hover:shadow-lg hover:shadow-black/20 w-full max-w-full">

        {/* Content Type Indicator */}
        <div className={`absolute top-2 sm:top-3 left-2 sm:left-3 p-1.5 sm:p-2 rounded-lg ${accentClass} transition-all duration-300 group-hover:scale-110 flex-shrink-0`}>
          <IconComponent className="h-3 w-3 sm:h-4 sm:w-4" />
        </div>

        <div className="pl-8 sm:pl-10 lg:pl-14 pr-2 sm:pr-3 lg:pr-4 py-2 sm:py-3 lg:py-4 w-full max-w-full overflow-hidden">
          {item.type === 'paragraph' && (
            <div className="prose prose-invert max-w-none w-full">
              <p className="text-white/90 text-sm sm:text-base leading-relaxed font-medium break-words hyphens-auto">
                <BoldRenderer text={item.text} bold={item.bold} />
              </p>
            </div>
          )}

          {item.type === 'bullet_list' && (
            <ul className="space-y-2 sm:space-y-3 w-full">
              {(item.items || []).map((listItem, i) => (
                <motion.li
                  key={i}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: (index * 0.1) + (i * 0.05) }}
                  className="flex items-start gap-2 sm:gap-3 text-white/90 w-full max-w-full"
                >
                  <div className="w-2 h-2 bg-emerald-400 rounded-full mt-2 sm:mt-2.5 flex-shrink-0 shadow-sm"></div>
                  <span className="text-sm sm:text-base leading-relaxed font-medium break-words hyphens-auto flex-1 min-w-0">
                    <BoldRenderer text={listItem.text} bold={listItem.bold} />
                  </span>
                </motion.li>
              ))}
            </ul>
          )}

          {item.type === 'numbered_list' && (
            <ol className="space-y-2 sm:space-y-3 w-full">
              {(item.items || []).map((listItem, i) => (
                <motion.li
                  key={i}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: (index * 0.1) + (i * 0.05) }}
                  className="flex items-start gap-2 sm:gap-3 text-white/90 w-full max-w-full"
                >
                  <div className="w-6 h-6 sm:w-7 sm:h-7 bg-purple-500 text-white rounded-full flex items-center justify-center text-xs sm:text-sm font-bold flex-shrink-0 shadow-sm">
                    {i + 1}
                  </div>
                  <span className="text-sm sm:text-base leading-relaxed font-medium pt-1 break-words hyphens-auto flex-1 min-w-0">
                    <BoldRenderer text={listItem.text} bold={listItem.bold} />
                  </span>
                </motion.li>
              ))}
            </ol>
          )}

          {item.type === 'table' && (
            <div className="rounded-lg overflow-x-auto bg-white/5 border border-white/20 w-full max-w-full">
              <Table className="min-w-full">
                <TableHeader>
                  <TableRow className="border-white/20 bg-white/10">
                    {(item.headers || []).map((header, i) => (
                      <TableHead key={i} className="text-white font-bold text-xs sm:text-sm border-white/20 px-2 sm:px-4 py-2 whitespace-nowrap">
                        {header}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(item.rows || []).map((row, i) => (
                    <TableRow key={i} className="border-white/10 hover:bg-white/5">
                      {(row.cells || []).map((cell, j) => (
                        <TableCell key={j} className="text-white/90 text-xs sm:text-sm border-white/10 px-2 sm:px-4 py-2 break-words">
                          {cell}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {item.type === 'note' && (
            <div className="relative w-full max-w-full">
              <div className="bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-400/30 rounded-lg p-3 sm:p-4">
                <div className="flex items-start gap-2 sm:gap-3">
                  <Info className="h-4 w-4 sm:h-5 sm:w-5 text-amber-300 flex-shrink-0 mt-0.5" />
                  <p className="text-amber-100 text-xs sm:text-sm font-medium leading-relaxed break-words hyphens-auto flex-1 min-w-0">
                    <span className="font-bold">Note: </span>
                    {item.text.replace(/^Note:\s*/i, '')}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

interface EnhancedSlideRendererProps {
  slide: Slide;
  index: number;
  isSelected?: boolean;
  isLoading?: boolean;
  isDissolving?: boolean;
  onDissolveComplete?: () => void;
}

export const EnhancedSlideRenderer: React.FC<EnhancedSlideRendererProps> = ({
  slide,
  index,
  isSelected = false,
  isLoading = false,
  isDissolving = false,
  onDissolveComplete
}) => {
  const { theme } = useTheme();

  const isDark = theme === 'dark';
  const slideGradients = isDark ? darkModeGradients : lightModeGradients;
  const gradientClass = slideGradients[index % slideGradients.length];

  const slideVariants = {
    hidden: { opacity: 0, scale: 0.95, y: 20 },
    visible: {
      opacity: 1,
      scale: 1,
      y: 0,
      transition: {
        duration: 0.6,
        ease: "easeOut",
        staggerChildren: 0.1
      }
    }
  };

  const shimmerVariants = {
    initial: { x: '-100%' },
    animate: {
      x: '100%',
      transition: {
        duration: 1.5,
        repeat: Infinity,
        ease: 'linear'
      }
    }
  };

  // Show loading state if slide has no content or if explicitly loading
  const showLoadingState = isLoading || !slide.content || slide.content.length === 0;

  if (showLoadingState) {
    return (
      <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${gradientClass} shadow-2xl border border-white/20 w-full max-w-full mobile-slide overflow-x-hidden`}>
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent"></div>
        <div className="relative p-3 sm:p-4 lg:p-6 xl:p-8 min-h-[280px] sm:min-h-[320px] lg:min-h-[400px] w-full max-w-full overflow-hidden">
          {/* Slide Header */}
          <div className="mb-6 sm:mb-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-1 h-8 sm:h-12 bg-white/80 rounded-full shadow-sm"></div>
              <div className="min-w-0 flex-1">
                <div className="text-white/60 text-xs sm:text-sm font-medium mb-1">Slide {index + 1}</div>
                <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-white leading-tight drop-shadow-sm break-words">
                  {slide.title}
                </h2>
              </div>
            </div>
          </div>

          {/* Loading Animation */}
          <div className="animate-pulse space-y-6">
            <div className="text-white/70 text-lg mb-4">Generating content...</div>
            <div className="space-y-4">
              <div className="h-4 bg-white/15 rounded w-full"></div>
              <div className="h-4 bg-white/15 rounded w-4/5"></div>
              <div className="h-4 bg-white/15 rounded w-3/5"></div>
              <div className="h-4 bg-white/15 rounded w-2/3"></div>
            </div>
            <div className="space-y-3 mt-6">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 bg-emerald-400/50 rounded-full"></div>
                <div className="h-3 bg-white/10 rounded w-4/5"></div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 bg-emerald-400/50 rounded-full"></div>
                <div className="h-3 bg-white/10 rounded w-3/5"></div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 bg-emerald-400/50 rounded-full"></div>
                <div className="h-3 bg-white/10 rounded w-5/6"></div>
              </div>
            </div>
          </div>

          {/* Floating Animation Elements */}
          <div className="absolute top-4 right-4">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full"
            />
          </div>

          {/* Slide Number Badge */}
          <div className="absolute bottom-4 right-4">
            <div className="bg-white/20 backdrop-blur-sm rounded-full px-3 py-1 border border-white/30">
              <span className="text-white/80 text-sm font-medium">{index + 1}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Check if this slide is being refreshed (has content but is loading)
  const isRefreshing = isLoading && slide.content.length > 0;

  return (
    <motion.div
      variants={slideVariants}
      initial="hidden"
      animate="visible"
      className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${gradientClass} shadow-2xl hover:shadow-3xl transition-all duration-500 border ${isDark ? 'border-white/10' : 'border-black/10'} ${isSelected ? `ring-4 ${isDark ? 'ring-white/40' : 'ring-black/20'} scale-[1.02]` : ''
        } w-full max-w-full mobile-slide overflow-x-hidden`}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
    >
      {/* Gradient Overlay */}
      <div className={`absolute inset-0 bg-gradient-to-t ${isDark ? 'from-black/30 via-transparent to-white/5' : 'from-black/10 via-transparent to-white/20'}`}></div>

      {/* Decorative Elements */}
      <div className="absolute top-0 right-0 w-16 h-16 sm:w-32 sm:h-32 bg-white/5 rounded-full -translate-y-8 translate-x-8 sm:-translate-y-16 sm:translate-x-16"></div>
      <div className="absolute bottom-0 left-0 w-12 h-12 sm:w-24 sm:h-24 bg-black/10 rounded-full translate-y-6 -translate-x-6 sm:translate-y-12 sm:-translate-x-12"></div>

      {/* Content Container */}

      <div className="relative p-3 sm:p-4 lg:p-6 xl:p-8 min-h-[280px] sm:min-h-[320px] lg:min-h-[400px] w-full max-w-full overflow-hidden">
        {/* Slide Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 sm:mb-6 lg:mb-8"
        >
          <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
            <div className="w-1 h-6 sm:h-8 lg:h-12 bg-white/80 rounded-full shadow-sm"></div>
            <div className="min-w-0 flex-1">
              <div className="text-white/60 text-xs sm:text-sm font-medium mb-1">Slide {index + 1}</div>
              <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-white leading-tight drop-shadow-sm break-words hyphens-auto">
                {slide.title}
              </h2>
            </div>
          </div>
        </motion.div>

        {/* Content Items */}
        <motion.div className="space-y-3 sm:space-y-4 lg:space-y-6 w-full max-w-full">
          {slide.content.map((item, contentIndex) => (
            <ContentItemRenderer
              key={contentIndex}
              item={item}
              index={contentIndex}
              slideIndex={index}
            />
          ))}
        </motion.div>

        {/* Slide Number Badge */}
        <div className="absolute bottom-3 sm:bottom-4 right-3 sm:right-4">
          <div className="bg-white/20 backdrop-blur-sm rounded-full px-2 sm:px-3 py-1 border border-white/30">
            <span className="text-white/80 text-xs sm:text-sm font-medium">{index + 1}</span>
          </div>
        </div>
      </div>

      {/* Innovative Shimmer Overlay for Refresh/Expand */}
      {isRefreshing && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/40 backdrop-blur-sm rounded-2xl flex items-center justify-center z-10"
        >
          <div className="relative overflow-hidden w-full h-full rounded-2xl">
            {/* Scanning Line Effect */}
            <motion.div
              variants={shimmerVariants}
              initial="initial"
              animate="animate"
              className="absolute inset-y-0 w-1 bg-gradient-to-b from-transparent via-white to-transparent opacity-80"
            />

            {/* Pulsing Dots */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex space-x-2">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    animate={{
                      scale: [1, 1.2, 1],
                      opacity: [0.5, 1, 0.5]
                    }}
                    transition={{
                      duration: 1.5,
                      repeat: Infinity,
                      delay: i * 0.2
                    }}
                    className="w-3 h-3 bg-white rounded-full"
                  />
                ))}
              </div>
            </div>

            {/* Status Text */}
            <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2">
              <motion.div
                animate={{ opacity: [0.7, 1, 0.7] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="bg-white/20 backdrop-blur-sm rounded-full px-4 py-2 border border-white/30"
              >
                <span className="text-white text-sm font-medium">
                  Regenerating content...
                </span>
              </motion.div>
            </div>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
};

export default EnhancedSlideRenderer;
